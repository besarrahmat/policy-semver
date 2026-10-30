import { execFile } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { loadCommitsSinceLastTag } from "./load-commits.js";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync("git", args, { cwd });
}

async function makeRepo(): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "ps-commits-"));
  await git(cwd, "init", "--quiet", "-b", "main");
  await git(cwd, "config", "user.name", "t");
  await git(cwd, "config", "user.email", "t@t.test");
  await git(cwd, "config", "commit.gpgsign", "false");
  await git(cwd, "config", "tag.gpgsign", "false");
  await git(cwd, "config", "core.hooksPath", "/dev/null");
  return cwd;
}

async function commit(cwd: string, message: string): Promise<void> {
  await git(cwd, "commit", "--quiet", "--allow-empty", "-m", message);
}

describe("loadCommitsSinceLastTag", { timeout: 30_000 }, () => {
  it("reads everything before the first tag", async () => {
    const cwd = await makeRepo();
    await commit(cwd, "feat: one");
    await commit(cwd, "fix: two");

    expect(await loadCommitsSinceLastTag(cwd, "v")).toEqual([
      { subject: "fix: two" },
      { subject: "feat: one" },
    ]);
  });

  it("stops at the last release tag", async () => {
    const cwd = await makeRepo();
    await commit(cwd, "feat: shipped");
    await git(cwd, "tag", "-a", "--no-sign", "v1.0.0", "-m", "v1.0.0");
    await commit(cwd, "fix: new\n\nBREAKING CHANGE: y");

    expect(await loadCommitsSinceLastTag(cwd, "v")).toEqual([
      { subject: "fix: new", body: "BREAKING CHANGE: y" },
    ]);
  });

  it("returns nothing right after a release", async () => {
    const cwd = await makeRepo();
    await commit(cwd, "feat: shipped");
    await git(cwd, "tag", "-a", "--no-sign", "v1.0.0", "-m", "v1.0.0");

    expect(await loadCommitsSinceLastTag(cwd, "v")).toEqual([]);
  });

  it("ignores tags with another prefix", async () => {
    const cwd = await makeRepo();
    await commit(cwd, "feat: one");
    await git(cwd, "tag", "-a", "--no-sign", "other-1", "-m", "other-1");
    await commit(cwd, "fix: two");

    expect(await loadCommitsSinceLastTag(cwd, "v")).toHaveLength(2);
  });

  it("throws outside a git repository", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "ps-nogit-"));

    await expect(loadCommitsSinceLastTag(cwd, "v")).rejects.toThrow();
  });
});
