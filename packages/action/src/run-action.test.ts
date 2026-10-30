import { execFile } from "node:child_process";
import { access, mkdtemp, writeFile } from "node:fs/promises";
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
    delete process.env.MARKER;
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

  async function setHook(remote: string, hooks: object): Promise<void> {
    const seed = await clone(remote);
    await writeFile(
      path.join(seed, "versioning.config.json"),
      JSON.stringify({ schemaVersion: "1", versionFiles: ["VERSION"], hooks }),
    );
    await git(seed, "add", "-A");
    await git(seed, "commit", "--quiet", "-m", "chore: hooks");
    await git(seed, "push", "--quiet", "origin", "main");
  }

  it("rerun after a failed release finishes it without a second bump", async () => {
    const remote = await makeRemote();
    setEvent("closed", pullRequest({ merged: true }));
    const staleSha = await git(remote, "rev-parse", "main");

    await workspace(remote);
    mocks.octokit.rest.repos.createRelease.mockRejectedValueOnce(
      new Error("502"),
    );
    await runAction();
    expect(mocks.core.setFailed).toHaveBeenCalledOnce();

    mocks.core.setFailed.mockClear();
    mocks.octokit.rest.repos.createRelease.mockClear();
    const rerun = await workspace(remote);
    await git(rerun, "checkout", "--quiet", "--detach", staleSha);
    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(await remoteTags(remote)).toEqual(["v1.1.0"]);
    expect(await git(remote, "show", "main:VERSION")).toBe("1.1.0");
    expect(mocks.octokit.rest.repos.createRelease).toHaveBeenCalledOnce();
    expect(
      mocks.octokit.rest.repos.createRelease.mock.calls[0]?.[0].body,
    ).toContain("## [1.1.0]");
    expect(output("next-version")).toBe("1.1.0");
    expect(output("kind")).toBe("minor");
  });

  it("rerun re-runs a failed afterRelease and creates no second release", async () => {
    const remote = await makeRemote();
    await setHook(remote, { afterRelease: 'test -f "$MARKER"' });
    const marker = path.join(await mkdtemp(path.join(tmpdir(), "ps-m-")), "m");
    process.env.MARKER = marker;
    setEvent("closed", pullRequest({ merged: true }));

    await workspace(remote);
    await runAction();
    expect(mocks.core.setFailed).toHaveBeenCalledOnce();
    expect(mocks.octokit.rest.repos.createRelease).toHaveBeenCalledOnce();

    mocks.core.setFailed.mockClear();
    await writeFile(marker, "");
    mocks.octokit.rest.repos.getReleaseByTag.mockResolvedValue({});
    await workspace(remote);
    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(mocks.octokit.rest.repos.createRelease).toHaveBeenCalledOnce();
    expect(await remoteTags(remote)).toEqual(["v1.1.0"]);
  });

  it("releases queued PRs in order from a stale checkout", async () => {
    const remote = await makeRemote();
    const staleSha = await git(remote, "rev-parse", "main");

    setEvent("closed", pullRequest({ number: 7, merged: true }));
    await workspace(remote);
    await runAction();

    setEvent("closed", pullRequest({ number: 8, merged: true }));
    const queued = await workspace(remote);
    await git(queued, "checkout", "--quiet", "--detach", staleSha);
    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(await remoteTags(remote)).toEqual(["v1.1.0", "v1.2.0"]);
    expect(await git(remote, "show", "main:VERSION")).toBe("1.2.0");
  });

  it("does not confuse PR 7 with PR 70", async () => {
    const remote = await makeRemote();
    setEvent("closed", pullRequest({ number: 70, merged: true }));
    await workspace(remote);
    await runAction();

    setEvent("closed", pullRequest({ number: 7, merged: true }));
    await workspace(remote);
    await runAction();

    expect(await remoteTags(remote)).toEqual(["v1.1.0", "v1.2.0"]);
  });

  it("fails on a taken tag before any hook or file write", async () => {
    const remote = await makeRemote();
    const marker = path.join(await mkdtemp(path.join(tmpdir(), "ps-m-")), "m");
    process.env.MARKER = marker;
    await setHook(remote, { beforeBump: 'touch "$MARKER"' });
    const seed = await clone(remote);
    await git(seed, "tag", "-a", "--no-sign", "v1.1.0", "-m", "v1.1.0");
    await git(seed, "push", "--quiet", "origin", "v1.1.0");
    setEvent("closed", pullRequest({ merged: true }));

    const cwd = await workspace(remote);
    await git(cwd, "tag", "-d", "v1.1.0");
    await runAction();

    expect(mocks.core.setFailed.mock.calls[0]?.[0]).toMatch(
      /tag already exists/,
    );
    await expect(access(marker)).rejects.toThrow();
    expect(await git(remote, "show", "main:VERSION")).toBe("1.0.0");
  });

  it("refuses a merged commit that is not on prod", async () => {
    const remote = await makeRemote();
    setEvent(
      "closed",
      pullRequest({ merged: true, merge_commit_sha: "0".repeat(40) }),
    );
    await workspace(remote);
    await runAction();

    expect(mocks.core.setFailed.mock.calls[0]?.[0]).toMatch(/is not on/);
    expect(await remoteTags(remote)).toEqual([]);
  });

  it("refuses a shallow checkout", async () => {
    const remote = await makeRemote();
    await git(remote, "config", "uploadpack.allowFilter", "true");
    setEvent("closed", pullRequest({ merged: true }));
    const shallow = await mkdtemp(path.join(tmpdir(), "ps-action-shallow-"));
    await git(
      shallow,
      "clone",
      "--quiet",
      "--depth",
      "1",
      `file://${remote}`,
      ".",
    );
    process.env.GITHUB_WORKSPACE = shallow;

    await runAction();

    expect(mocks.core.setFailed.mock.calls[0]?.[0]).toMatch(/fetch-depth: 0/);
    expect(await remoteTags(remote)).toEqual([]);
  });

  it("does nothing for a docs-only merge", async () => {
    const remote = await makeRemote();
    mocks.octokit.paginate.mockResolvedValue([
      { commit: { message: "docs: readme" } },
    ]);
    setEvent(
      "closed",
      pullRequest({ merged: true, title: "docs: update readme" }),
    );
    await workspace(remote);
    await runAction();

    expect(output("kind")).toBe("none");
    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(await git(remote, "rev-list", "--count", "main")).toBe("1");
  });

  it("releases when a configured version file does not exist", async () => {
    const remote = await makeRemote();
    const seed = await clone(remote);
    await writeFile(
      path.join(seed, "versioning.config.json"),
      JSON.stringify({ schemaVersion: "1" }),
    );
    await git(seed, "add", "-A");
    await git(seed, "commit", "--quiet", "-m", "chore: default version files");
    await git(seed, "push", "--quiet", "origin", "main");
    setEvent("closed", pullRequest({ merged: true }));

    await workspace(remote);
    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(await git(remote, "show", "main:VERSION")).toBe("1.1.0");
  });

  it("only validates a merge_group, never writes", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    mocks.context.eventName = "merge_group";
    mocks.context.payload = {
      merge_group: { base_ref: "refs/heads/main", head_ref: "refs/heads/q" },
    };

    await runAction();
    mocks.context.eventName = "pull_request";

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(await remoteTags(remote)).toEqual([]);
  });
});
