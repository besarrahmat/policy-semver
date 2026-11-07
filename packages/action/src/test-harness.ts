import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { type Mock, vi } from "vitest";

const fn = (): Mock => vi.fn();

/**
 * Shared by tests that drive `runAction` against real git and a bare remote.
 * A test file wires the mocks up with:
 *   vi.mock("@actions/core", async () => (await import("./test-harness.js")).mocks.core);
 *   vi.mock("@actions/github", async () => (await import("./test-harness.js")).actionsGithub());
 */
export const mocks = {
  core: {
    getInput: fn(),
    getBooleanInput: fn(),
    setOutput: fn(),
    setFailed: fn(),
    info: fn(),
    warning: fn(),
    setSecret: fn(),
    summary: {
      addHeading: fn().mockReturnThis(),
      addCodeBlock: fn().mockReturnThis(),
      write: fn(),
    },
  },
  context: {
    eventName: "pull_request",
    ref: "refs/pull/7/merge",
    repo: { owner: "o", repo: "r" },
    payload: {} as Record<string, unknown>,
  },
  octokit: {
    paginate: fn(),
    rest: {
      pulls: { listCommits: {} },
      issues: {
        listComments: fn(),
        createComment: fn(),
        updateComment: fn(),
      },
      repos: { getReleaseByTag: fn(), createRelease: fn() },
    },
  },
};

export function actionsGithub() {
  return { context: mocks.context, getOctokit: () => mocks.octokit };
}

export function resetActionMocks(): void {
  vi.clearAllMocks();
  mocks.core.summary.addHeading.mockReturnThis();
  mocks.core.summary.addCodeBlock.mockReturnThis();
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
}

const execFileAsync = promisify(execFile);

export async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

/** `config` overrides the isolation below, to reproduce a consumer's repo setup. */
export async function clone(
  remote: string,
  config: Record<string, string> = {},
): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "ps-action-work-"));
  await git(cwd, "clone", "--quiet", remote, ".");
  const settings = {
    "user.name": "t",
    "user.email": "t@t.test",
    "commit.gpgsign": "false",
    "tag.gpgsign": "false",
    // A developer's global hooks must not slow down or fail these repos.
    "core.hooksPath": "/dev/null",
    ...config,
  };
  for (const [key, value] of Object.entries(settings)) {
    await git(cwd, "config", key, value);
  }
  return cwd;
}

/** A bare remote whose `main` holds `files`; defaults to a VERSION-only app. */
export async function makeRemote(
  files: Record<string, string> = {
    VERSION: "1.0.0\n",
    "versioning.config.json": JSON.stringify({
      schemaVersion: "1",
      versionFiles: ["VERSION"],
    }),
  },
): Promise<string> {
  const remote = await mkdtemp(path.join(tmpdir(), "ps-action-remote-"));
  await git(remote, "init", "--quiet", "--bare", "-b", "main");
  const seed = await clone(remote);
  await git(seed, "checkout", "--quiet", "-B", "main");
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(path.join(seed, rel), content);
  }
  await git(seed, "add", "-A");
  await git(seed, "commit", "--quiet", "-m", "init");
  await git(seed, "push", "--quiet", "origin", "main");
  return remote;
}

export async function workspace(
  remote: string,
  config: Record<string, string> = {},
): Promise<string> {
  const cwd = await clone(remote, config);
  process.env.GITHUB_WORKSPACE = cwd;
  return cwd;
}

export function pullRequest(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    number: 7,
    title: "feat: add thing",
    body: "",
    labels: [],
    base: { ref: "main", repo: { full_name: "o/r" } },
    head: { ref: "feature", repo: { full_name: "o/r" } },
    ...overrides,
  };
}

export function setEvent(action: string, pr: Record<string, unknown>): void {
  mocks.context.payload = { action, pull_request: pr };
}

export function output(name: string): unknown {
  return mocks.core.setOutput.mock.calls
    .filter((c) => c[0] === name)
    .at(-1)?.[1];
}

export async function remoteTags(remote: string): Promise<string[]> {
  return (await git(remote, "tag", "-l")).split("\n").filter(Boolean);
}
