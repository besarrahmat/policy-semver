import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { writeChangelog } from "../changelog/write-changelog.js";
import { runRelease } from "./run-release.js";

function auditSeams() {
  return {
    gitSha: "deadbeef",
    writeAudit: vi.fn(async () => ({
      version: "0.0.0",
      kind: "patch" as const,
      gitSha: "deadbeef",
      tag: "v0.0.0",
      at: "2026-08-08T00:00:00.000Z",
    })),
  };
}

function mockOctokit() {
  return {
    repos: {
      getReleaseByTag: vi.fn(async () => {
        const err = new Error("Not Found") as Error & { status: number };
        err.status = 404;
        throw err;
      }),
      createRelease: vi.fn(async () => ({})),
    },
  };
}

describe("runRelease", () => {
  it("kind none → no commit, no tag, no push, no release", async () => {
    const commit = vi.fn();
    const tag = vi.fn();
    const push = vi.fn();
    const release = vi.fn();
    const octokit = mockOctokit();

    const result = await runRelease({
      kind: "none",
      cwd: "/tmp",
      version: "1.2.3",
      paths: ["VERSION"],
      branch: "main",
      sectionMarkdown: "## [1.2.3] - 2026-08-08\n",
      owner: "o",
      repo: "r",
      octokit,
      commit,
      tag,
      push,
      release,
    });

    expect(result).toEqual({ skipped: true, reason: "kind-none" });
    expect(commit).not.toHaveBeenCalled();
    expect(tag).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(octokit.repos.createRelease).not.toHaveBeenCalled();
  });

  it("none skips changelog + tag + release", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "ps-none-"));
    const changelog = await writeChangelog({
      cwd,
      changelogPath: "CHANGELOG.md",
      version: "1.0.1",
      date: "2026-08-08",
      kind: "none",
      commits: [{ subject: "feat: should not appear" }],
    });
    expect(changelog.wrote).toBe(false);
    expect(changelog.reason).toBe("kind-none");
    await expect(
      readFile(path.join(cwd, "CHANGELOG.md"), "utf8"),
    ).rejects.toThrow();

    const commit = vi.fn();
    const tag = vi.fn();
    const push = vi.fn();
    const release = vi.fn();
    const octokit = mockOctokit();

    const result = await runRelease({
      kind: "none",
      cwd,
      version: "1.0.1",
      paths: ["VERSION"],
      branch: "main",
      sectionMarkdown: "",
      owner: "o",
      repo: "r",
      octokit,
      commit,
      tag,
      push,
      release,
    });

    expect(result).toEqual({ skipped: true, reason: "kind-none" });
    expect(commit).not.toHaveBeenCalled();
    expect(tag).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
    expect(octokit.repos.createRelease).not.toHaveBeenCalled();
  });

  it("minor → commit, tag, push, release in order", async () => {
    const calls: string[] = [];
    const commit = vi.fn(async () => {
      calls.push("commit");
    });
    const tag = vi.fn(async () => {
      calls.push("tag");
    });
    const push = vi.fn(async () => {
      calls.push("push");
    });
    const release = vi.fn(async () => {
      calls.push("release");
    });

    const seams = auditSeams();
    const result = await runRelease({
      kind: "minor",
      cwd: "/tmp",
      version: "1.2.3",
      tagPrefix: "v",
      paths: ["VERSION", "package.json", "CHANGELOG.md"],
      branch: "main",
      sectionMarkdown: "## [1.2.3] - 2026-08-08\n\n### Added\n- x\n",
      owner: "acme",
      repo: "app",
      octokit: mockOctokit(),
      commit,
      tag,
      push,
      release,
      ...seams,
    });

    expect(result).toEqual({
      skipped: false,
      tag: "v1.2.3",
      committed: true,
      pushed: true,
      released: true,
    });
    expect(calls).toEqual([
      "commit",
      "tag",
      "push",
      "release",
      "commit",
      "push",
    ]);
    expect(commit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("[skip version]"),
        paths: ["VERSION", "package.json", "CHANGELOG.md"],
      }),
    );
    expect(commit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        paths: [".policy-semver/last-release.json"],
        message: expect.stringContaining("[skip version]"),
      }),
    );
    expect(push).toHaveBeenLastCalledWith(
      expect.objectContaining({ refs: ["main"] }),
    );
    expect(tag).toHaveBeenCalledWith(
      expect.objectContaining({ tag: "v1.2.3" }),
    );
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({ refs: ["main", "v1.2.3"] }),
    );
    expect(release).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: "acme",
        repo: "app",
        tag: "v1.2.3",
        body: expect.stringContaining("## [1.2.3]"),
      }),
    );
    expect(seams.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "1.2.3",
        kind: "minor",
        gitSha: "deadbeef",
        tag: "v1.2.3",
      }),
    );
  });

  it("afterTag then afterRelease; afterTag failure skips push+release", async () => {
    const calls: string[] = [];
    const hookExec = vi.fn(async (command: string) => {
      if (command === "afterTag-cmd") {
        calls.push("afterTag");
        throw Object.assign(new Error("boom"), { code: 1 });
      }
      calls.push("afterRelease");
      return { stdout: "", stderr: "" };
    });
    const commit = vi.fn(async () => {
      calls.push("commit");
    });
    const tag = vi.fn(async () => {
      calls.push("tag");
    });
    const push = vi.fn(async () => {
      calls.push("push");
    });
    const release = vi.fn(async () => {
      calls.push("release");
    });

    await expect(
      runRelease({
        kind: "minor",
        cwd: "/tmp",
        version: "1.2.3",
        paths: ["VERSION"],
        branch: "main",
        sectionMarkdown: "## [1.2.3]\n",
        owner: "o",
        repo: "r",
        octokit: mockOctokit(),
        commit,
        tag,
        push,
        release,
        hooks: { afterTag: "afterTag-cmd", afterRelease: "afterRelease-cmd" },
        hookExec,
      }),
    ).rejects.toThrow(/hook afterTag failed/);

    expect(calls).toEqual(["commit", "tag", "afterTag"]);
    expect(push).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it("happy path: commit, tag, afterTag, push, release, afterRelease", async () => {
    const calls: string[] = [];
    const hookExec = vi.fn(async (command: string) => {
      calls.push(command);
      return { stdout: "", stderr: "" };
    });
    const commit = vi.fn(async () => {
      calls.push("commit");
    });
    const tag = vi.fn(async () => {
      calls.push("tag");
    });
    const push = vi.fn(async () => {
      calls.push("push");
    });
    const release = vi.fn(async () => {
      calls.push("release");
    });

    const seams = auditSeams();
    await runRelease({
      kind: "patch",
      cwd: "/tmp",
      version: "1.0.1",
      paths: ["VERSION"],
      branch: "main",
      sectionMarkdown: "## [1.0.1]\n",
      owner: "o",
      repo: "r",
      octokit: mockOctokit(),
      commit,
      tag,
      push,
      release,
      hooks: { afterTag: "afterTag-cmd", afterRelease: "afterRelease-cmd" },
      hookExec,
      ...seams,
    });

    expect(calls).toEqual([
      "commit",
      "tag",
      "afterTag-cmd",
      "push",
      "release",
      "afterRelease-cmd",
      "commit",
      "push",
    ]);
    expect(seams.writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        version: "1.0.1",
        kind: "patch",
        gitSha: "deadbeef",
        tag: "v1.0.1",
      }),
    );
  });

  it("afterRelease failure skips last-release.json", async () => {
    const writeAudit = vi.fn();
    const hookExec = vi.fn(async () => {
      throw Object.assign(new Error("boom"), { code: 1 });
    });
    await expect(
      runRelease({
        kind: "minor",
        cwd: "/tmp",
        version: "1.2.3",
        paths: ["VERSION"],
        branch: "main",
        sectionMarkdown: "## [1.2.3]\n",
        owner: "o",
        repo: "r",
        octokit: mockOctokit(),
        commit: vi.fn(),
        tag: vi.fn(),
        push: vi.fn(),
        release: vi.fn(),
        hooks: { afterTag: null, afterRelease: "fail" },
        hookExec,
        gitSha: "deadbeef",
        writeAudit,
      }),
    ).rejects.toThrow(/hook afterRelease failed/);
    expect(writeAudit).not.toHaveBeenCalled();
  });
});
