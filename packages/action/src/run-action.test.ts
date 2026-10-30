import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAction } from "./run-action.js";

const mocks = vi.hoisted(() => ({
  core: {
    getInput: vi.fn(),
    getBooleanInput: vi.fn(),
    setOutput: vi.fn(),
    setFailed: vi.fn(),
    info: vi.fn(),
  },
  context: {
    eventName: "pull_request",
    ref: "refs/pull/7/merge",
    repo: { owner: "o", repo: "r" },
    payload: {} as Record<string, unknown>,
  },
  octokit: {
    paginate: vi.fn(),
    rest: {
      pulls: { listCommits: {} },
      issues: {
        listComments: vi.fn(),
        createComment: vi.fn(),
        updateComment: vi.fn(),
      },
      repos: { getReleaseByTag: vi.fn(), createRelease: vi.fn() },
    },
  },
}));

vi.mock("@actions/core", () => mocks.core);
vi.mock("@actions/github", () => ({
  context: mocks.context,
  getOctokit: () => mocks.octokit,
}));

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function clone(remote: string): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "ps-action-work-"));
  await git(cwd, "clone", "--quiet", remote, ".");
  await git(cwd, "config", "user.name", "t");
  await git(cwd, "config", "user.email", "t@t.test");
  await git(cwd, "config", "commit.gpgsign", "false");
  await git(cwd, "config", "tag.gpgsign", "false");
  // A developer's global hooks must not slow down or fail these repos.
  await git(cwd, "config", "core.hooksPath", "/dev/null");
  return cwd;
}

async function makeRemote(): Promise<string> {
  const remote = await mkdtemp(path.join(tmpdir(), "ps-action-remote-"));
  await git(remote, "init", "--quiet", "--bare", "-b", "main");
  const seed = await clone(remote);
  await git(seed, "checkout", "--quiet", "-B", "main");
  await writeFile(path.join(seed, "VERSION"), "1.0.0\n");
  await writeFile(
    path.join(seed, "versioning.config.json"),
    JSON.stringify({ schemaVersion: "1", versionFiles: ["VERSION"] }),
  );
  await git(seed, "add", "-A");
  await git(seed, "commit", "--quiet", "-m", "init");
  await git(seed, "push", "--quiet", "origin", "main");
  return remote;
}

function pullRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number: 7,
    title: "feat: add thing",
    body: "",
    labels: [],
    base: { ref: "main" },
    head: { ref: "feature", repo: { fork: false } },
    ...overrides,
  };
}

function setEvent(action: string, pr: Record<string, unknown>): void {
  mocks.context.payload = { action, pull_request: pr };
}

function output(name: string): unknown {
  return mocks.core.setOutput.mock.calls.find((c) => c[0] === name)?.[1];
}

async function remoteTags(remote: string): Promise<string[]> {
  return (await git(remote, "tag", "-l")).split("\n").filter(Boolean);
}

// Real git subprocesses: a full release spawns dozens of them.
describe("runAction", { timeout: 30_000 }, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.POLICY_SEMVER_TOKEN;
    delete process.env.APP_VERSION_MAJOR;
    mocks.core.getInput.mockImplementation((name: string) =>
      name === "token" ? "test-token" : "",
    );
    mocks.core.getBooleanInput.mockReturnValue(false);
    mocks.octokit.paginate.mockResolvedValue([
      { commit: { message: "feat: add thing" } },
    ]);
    mocks.octokit.rest.issues.listComments.mockResolvedValue({ data: [] });
    mocks.octokit.rest.repos.getReleaseByTag.mockRejectedValue(
      Object.assign(new Error("Not Found"), { status: 404 }),
    );
    mocks.octokit.rest.repos.createRelease.mockResolvedValue({});
  });

  async function workspace(remote: string): Promise<string> {
    const cwd = await clone(remote);
    process.env.GITHUB_WORKSPACE = cwd;
    return cwd;
  }

  it("skips a PR that does not target prod", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent("opened", pullRequest({ base: { ref: "dev" } }));

    await runAction();

    expect(output("skipped-reason")).toContain("non-prod base");
    expect(mocks.octokit.rest.issues.createComment).not.toHaveBeenCalled();
    expect(await remoteTags(remote)).toEqual([]);
  });

  it("comments a dry-run on an open PR without writing", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent("opened", pullRequest());

    await runAction();

    expect(output("kind")).toBe("minor");
    expect(output("next-version")).toBe("1.1.0");
    expect(mocks.octokit.rest.issues.createComment).toHaveBeenCalledOnce();
    expect(await remoteTags(remote)).toEqual([]);
  });

  it("never writes for a merged fork PR", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent(
      "closed",
      pullRequest({
        merged: true,
        head: { ref: "feature", repo: { fork: true } },
      }),
    );

    await runAction();

    expect(await remoteTags(remote)).toEqual([]);
    expect(mocks.octokit.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("releases a merged PR", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent("closed", pullRequest({ merged: true }));

    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(await git(remote, "show", "main:VERSION")).toBe("1.1.0");
    expect(await remoteTags(remote)).toEqual(["v1.1.0"]);
    expect(mocks.octokit.rest.repos.createRelease).toHaveBeenCalledOnce();
  });

  it("forces none for a skip label", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent(
      "closed",
      pullRequest({ merged: true, labels: [{ name: "skip-version" }] }),
    );

    await runAction();

    expect(output("kind")).toBe("none");
    expect(await remoteTags(remote)).toEqual([]);
  });

  // Characterization: documents today's double bump until reruns are safe.
  it("double-bumps when a failed release is rerun", async () => {
    const remote = await makeRemote();
    setEvent("closed", pullRequest({ merged: true }));
    const staleSha = await git(remote, "rev-parse", "main");

    await workspace(remote);
    mocks.octokit.rest.repos.createRelease.mockRejectedValueOnce(
      new Error("502"),
    );
    await runAction();
    expect(mocks.core.setFailed).toHaveBeenCalledOnce();

    const rerun = await workspace(remote);
    await git(rerun, "checkout", "--quiet", "--detach", staleSha);
    await runAction();

    expect(await remoteTags(remote)).toEqual(["v1.1.0", "v1.2.0"]);
    expect(await git(remote, "show", "main:VERSION")).toBe("1.1.0");
  });
});
