import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { remoteTagSha } from "../git/tag.js";
import { runRelease } from "./run-release.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, { cwd });
  return stdout.trim();
}

async function clone(remote: string): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "ps-work-"));
  await git(cwd, "clone", "--quiet", remote, ".");
  await git(cwd, "config", "user.name", "t");
  await git(cwd, "config", "user.email", "t@t.test");
  await git(cwd, "config", "commit.gpgsign", "false");
  await git(cwd, "config", "tag.gpgsign", "false");
  // A developer's global hooks must not slow down or fail these repos.
  await git(cwd, "config", "core.hooksPath", "/dev/null");
  return cwd;
}

async function makeRepo(): Promise<{ remote: string; work: string }> {
  const remote = await mkdtemp(path.join(tmpdir(), "ps-remote-"));
  await git(remote, "init", "--quiet", "--bare", "-b", "main");
  const work = await clone(remote);
  await git(work, "checkout", "--quiet", "-B", "main");
  await writeFile(path.join(work, "VERSION"), "1.0.0\n");
  await git(work, "add", "-A");
  await git(work, "commit", "--quiet", "-m", "init");
  await git(work, "push", "--quiet", "origin", "main");
  return { remote, work };
}

function okOctokit() {
  return {
    repos: {
      getReleaseByTag: vi.fn(async () => {
        throw Object.assign(new Error("Not Found"), { status: 404 });
      }),
      createRelease: vi.fn(async () => ({})),
    },
  };
}

async function release(work: string, octokit = okOctokit()) {
  await writeFile(path.join(work, "VERSION"), "1.1.0\n");
  return runRelease({
    kind: "minor",
    cwd: work,
    version: "1.1.0",
    paths: ["VERSION"],
    branch: "main",
    sectionMarkdown: "## [1.1.0]\n",
    owner: "o",
    repo: "r",
    octokit,
  });
}

async function remoteHasTag(remote: string, tag: string): Promise<boolean> {
  const listed = await git(remote, "tag", "-l", tag);
  return listed === tag;
}

describe("runRelease against a real git remote", { timeout: 30_000 }, () => {
  it("publishes the bump commit, annotated tag and release", async () => {
    const { remote, work } = await makeRepo();
    const octokit = okOctokit();

    const result = await release(work, octokit);

    expect(result).toMatchObject({ skipped: false, tag: "v1.1.0" });
    expect(await git(remote, "show", "main:VERSION")).toBe("1.1.0");
    expect(await git(remote, "cat-file", "-t", "v1.1.0")).toBe("tag");
    expect(octokit.repos.createRelease).toHaveBeenCalledOnce();
  });

  it("signs as the bot without rewriting the repo's identity", async () => {
    const { remote, work } = await makeRepo();
    await release(work);

    expect(await git(remote, "log", "-1", "--format=%an", "main")).toBe(
      "github-actions[bot]",
    );
    expect(
      await git(
        remote,
        "for-each-ref",
        "--format=%(taggername)",
        "refs/tags/v1.1.0",
      ),
    ).toBe("github-actions[bot]");
    expect(await git(work, "config", "--local", "user.name")).toBe("t");
  });

  it("resolves an annotated remote tag to its commit", async () => {
    const { work } = await makeRepo();
    await release(work);

    expect(await remoteTagSha({ cwd: work, tag: "v1.1.0" })).toBe(
      await git(work, "rev-parse", "HEAD"),
    );
    expect(await remoteTagSha({ cwd: work, tag: "v9.9.9" })).toBeNull();
  });

  it("publishes one commit carrying the audit file", async () => {
    const { remote, work } = await makeRepo();
    await release(work);

    expect(await git(remote, "rev-list", "--count", "main")).toBe("2");
    expect(await git(remote, "rev-parse", "main")).toBe(
      await git(remote, "rev-parse", "v1.1.0^{commit}"),
    );
    const audit = JSON.parse(
      await git(remote, "show", "main:.policy-semver/last-release.json"),
    );
    expect(audit).toMatchObject({ version: "1.1.0", tag: "v1.1.0" });
    expect(audit).not.toHaveProperty("gitSha");
  });

  it("still releases when the consumer gitignores the audit file", async () => {
    const { remote, work } = await makeRepo();
    await writeFile(path.join(work, ".gitignore"), ".policy-semver/\n");
    await git(work, "add", "-A");
    await git(work, "commit", "--quiet", "-m", "chore: ignore audit");
    await git(work, "push", "--quiet", "origin", "main");

    await release(work);

    expect(await git(remote, "show", "main:VERSION")).toBe("1.1.0");
    await expect(
      git(remote, "show", "main:.policy-semver/last-release.json"),
    ).rejects.toThrow();
  });

  it("publishes nothing when the branch push is rejected", async () => {
    const { remote, work } = await makeRepo();
    const other = await clone(remote);
    await writeFile(path.join(other, "other.txt"), "x\n");
    await git(other, "add", "-A");
    await git(other, "commit", "--quiet", "-m", "fix: other");
    await git(other, "push", "--quiet", "origin", "main");

    await expect(release(work)).rejects.toThrow();

    expect(await git(remote, "show", "main:VERSION")).toBe("1.0.0");
    expect(await remoteHasTag(remote, "v1.1.0")).toBe(false);
  });

  it("keeps branch and tag public when the release call fails", async () => {
    const { remote, work } = await makeRepo();
    const octokit = okOctokit();
    octokit.repos.createRelease.mockRejectedValue(new Error("502"));

    await expect(release(work, octokit)).rejects.toThrow("502");

    expect(await git(remote, "show", "main:VERSION")).toBe("1.1.0");
    expect(await remoteHasTag(remote, "v1.1.0")).toBe(true);
  });

  it("fails on an existing remote tag and pushes nothing", async () => {
    const { remote, work } = await makeRepo();
    await git(work, "tag", "-a", "--no-sign", "v1.1.0", "-m", "v1.1.0");
    await git(work, "push", "--quiet", "origin", "v1.1.0");
    await git(work, "tag", "-d", "v1.1.0");

    await expect(release(work)).rejects.toThrow("mirror tag conflict");

    expect(await git(remote, "show", "main:VERSION")).toBe("1.0.0");
  });
});
