import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { runAction } from "./run-action.js";
import {
  clone,
  git,
  makeRemote,
  mocks,
  output,
  pullRequest,
  remoteTags,
  resetActionMocks,
  setEvent,
  workspace,
} from "./test-harness.js";

vi.mock(
  "@actions/core",
  async () => (await import("./test-harness.js")).mocks.core,
);
vi.mock("@actions/github", async () =>
  (await import("./test-harness.js")).actionsGithub(),
);

function app(
  config: Record<string, unknown> = {},
  files: Record<string, string> = {},
): Record<string, string> {
  return {
    VERSION: "1.0.0\n",
    "versioning.config.json": JSON.stringify({
      schemaVersion: "1",
      versionFiles: ["VERSION"],
      ...config,
    }),
    ...files,
  };
}

/** Land a commit on the remote's main, outside any release. */
async function land(
  remote: string,
  files: Record<string, string>,
  message = "chore: edit",
): Promise<void> {
  const seed = await clone(remote);
  for (const [rel, content] of Object.entries(files)) {
    await writeFile(path.join(seed, rel), content);
  }
  await git(seed, "add", "-A");
  await git(seed, "commit", "--quiet", "-m", message);
  await git(seed, "push", "--quiet", "origin", "main");
}

async function merged(pr: Record<string, unknown> = {}): Promise<void> {
  setEvent("closed", pullRequest({ merged: true, ...pr }));
  await runAction();
}

function commitsAre(...messages: string[]): void {
  mocks.octokit.paginate.mockResolvedValue(
    messages.map((message) => ({ commit: { message } })),
  );
}

function failure(): string {
  return String(mocks.core.setFailed.mock.calls.at(-1)?.[0] ?? "");
}

async function hooksDir(hook: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "ps-hooks-"));
  await writeFile(path.join(dir, hook), "#!/bin/sh\nexit 1\n");
  await chmod(path.join(dir, hook), 0o755);
  return dir;
}

function expectReleased(): void {
  expect(failure()).toBe("");
  expect(output("released")).toBe("true");
}

// Real git subprocesses: a full release spawns dozens of them.
describe("repos the release must survive", { timeout: 30_000 }, () => {
  beforeEach(resetActionMocks);

  describe("consumer git setup", () => {
    for (const hook of ["pre-commit", "commit-msg", "pre-push"]) {
      it.fails(`a failing ${hook} hook (husky, commitlint) does not stop the release`, async () => {
        const remote = await makeRemote(app());
        await workspace(remote, { "core.hooksPath": await hooksDir(hook) });
        await merged();
        expectReleased();
      });
    }

    it.fails("commit.gpgsign with no usable key does not stop the release", async () => {
      const remote = await makeRemote(app());
      await workspace(remote, {
        "commit.gpgsign": "true",
        "gpg.program": "/usr/bin/false",
      });
      await merged();
      expectReleased();
    });

    it("tag.gpgsign with no usable key does not stop the release", async () => {
      const remote = await makeRemote(app());
      await workspace(remote, {
        "tag.gpgsign": "true",
        "gpg.program": "/usr/bin/false",
      });
      await merged();
      expectReleased();
    });
  });

  describe("ref names", () => {
    it.fails("a tag named like the prod branch does not break the push", async () => {
      const remote = await makeRemote(app());
      await git(remote, "tag", "main", "main");
      await workspace(remote);
      await merged();
      expectReleased();
      expect(await git(remote, "show", "refs/heads/main:VERSION")).toBe(
        "1.1.0",
      );
    });

    it.fails("a branch named like the next tag does not break the push", async () => {
      const remote = await makeRemote(app());
      await git(remote, "branch", "v1.1.0", "main");
      const cwd = await workspace(remote);
      await git(cwd, "branch", "v1.1.0", "origin/v1.1.0");
      await merged();
      expectReleased();
    });

    it("a prod branch with a slash releases", async () => {
      const remote = await makeRemote(app({ prodBranch: "release/main" }));
      await git(remote, "branch", "release/main", "main");
      await workspace(remote);
      await merged({
        base: { ref: "release/main", repo: { full_name: "o/r" } },
      });
      expectReleased();
    });

    for (const tagPrefix of ["", "release/", "app-v"]) {
      it(`tagPrefix ${JSON.stringify(tagPrefix)} releases`, async () => {
        const remote = await makeRemote(app({ tagPrefix }));
        await workspace(remote);
        await merged();
        expectReleased();
        expect(await remoteTags(remote)).toEqual([`${tagPrefix}1.1.0`]);
      });
    }
  });

  describe("version files", () => {
    const PKG = ["package.json"];

    it.fails("keeps CRLF line endings in package.json", async () => {
      const raw = '{\r\n  "name": "a",\r\n  "version": "1.0.0"\r\n}\r\n';
      const remote = await makeRemote(
        app({ versionFiles: PKG }, { "package.json": raw }),
      );
      const cwd = await workspace(remote);
      await merged();
      expectReleased();
      expect(await readFile(path.join(cwd, "package.json"), "utf8")).toBe(
        raw.replace("1.0.0", "1.1.0"),
      );
    });

    it.fails("changes only the version in package.json", async () => {
      const raw =
        '{\n\t"name": "caf\\u00e9",\n\t"version": "1.0.0",\n\t"2": "b",\n\t"1": "a"\n}';
      const remote = await makeRemote(
        app({ versionFiles: PKG }, { "package.json": raw }),
      );
      const cwd = await workspace(remote);
      await merged();
      expectReleased();
      expect(await readFile(path.join(cwd, "package.json"), "utf8")).toBe(
        raw.replace("1.0.0", "1.1.0"),
      );
    });

    it.fails("reads a package.json with a BOM", async () => {
      const remote = await makeRemote(
        app(
          { versionFiles: PKG },
          { "package.json": '﻿{"name":"a","version":"1.0.0"}\n' },
        ),
      );
      await workspace(remote);
      await merged();
      expectReleased();
    });

    it("names the file when package.json has no version", async () => {
      const remote = await makeRemote(
        app({ versionFiles: PKG }, { "package.json": '{"name":"a"}\n' }),
      );
      await workspace(remote);
      await expect(merged()).rejects.toThrow(/package\.json/);
      expect(await remoteTags(remote)).toEqual([]);
    });

    it("a missing extra package.json fails before anything is public", async () => {
      const remote = await makeRemote(
        app(
          { versionFiles: ["VERSION", "package.json", "b/package.json"] },
          {
            "package.json": '{"version":"1.0.0"}\n',
          },
        ),
      );
      await workspace(remote);
      await merged();
      expect(failure()).toContain("b/package.json");
      expect(await remoteTags(remote)).toEqual([]);
    });

    it("a version file in a subdirectory releases", async () => {
      const remote = await makeRemote(app());
      const seed = await clone(remote);
      await mkdir(path.join(seed, "a"));
      await writeFile(path.join(seed, "a/VERSION"), "1.0.0\n");
      await writeFile(
        path.join(seed, "versioning.config.json"),
        JSON.stringify({ schemaVersion: "1", versionFiles: ["a/VERSION"] }),
      );
      await git(seed, "add", "-A");
      await git(seed, "commit", "--quiet", "-m", "chore: move");
      await git(seed, "push", "--quiet", "origin", "main");
      await workspace(remote);
      await merged();
      expectReleased();
    });

    it("rejects config paths that leave the repo", async () => {
      const remote = await makeRemote(app({ changelogPath: "../outside.md" }));
      await workspace(remote);
      await expect(merged()).rejects.toThrow(/changelogPath/);
    });

    it.fails("a gitignored changelog fails before anything is public, and not as rerun-safe", async () => {
      const remote = await makeRemote(
        app({}, { ".gitignore": "CHANGELOG.md\n" }),
      );
      await workspace(remote);
      await merged();
      expect(failure()).not.toBe("");
      expect(failure()).not.toContain("Rerunning this job is safe");
      expect(await remoteTags(remote)).toEqual([]);
    });
  });

  describe("version history", () => {
    it.fails("VERSION behind an existing tag says how to recover, not to rerun", async () => {
      const remote = await makeRemote(app());
      await git(remote, "tag", "v1.1.0", "main");
      await workspace(remote);
      await merged();
      expect(failure()).toMatch(/v1\.1\.0/);
      expect(failure()).toMatch(/VERSION|version/);
      expect(failure()).not.toContain("Rerunning this job is safe");
    });

    it("a PR that edits VERSION to a new major does not release without the env (I3)", async () => {
      const remote = await makeRemote(app());
      await git(remote, "tag", "v1.0.0", "main");
      await land(remote, { VERSION: "5.0.0\n" });
      await workspace(remote);
      await merged();
      expect(await remoteTags(remote)).toEqual(["v1.0.0"]);
      expect(failure()).toContain("APP_VERSION_MAJOR");
    });

    it("the env still allows that major", async () => {
      const remote = await makeRemote(app());
      await git(remote, "tag", "v1.0.0", "main");
      await land(remote, { VERSION: "5.0.0\n" });
      await workspace(remote);
      process.env.APP_VERSION_MAJOR = "5";
      await merged();
      expectReleased();
      expect(await remoteTags(remote)).toEqual(["v1.0.0", "v5.1.0"]);
    });

    it("a first release with no tags is not treated as a major jump", async () => {
      const remote = await makeRemote(app());
      await land(remote, { VERSION: "3.0.0\n" });
      await workspace(remote);
      await merged();
      expectReleased();
    });
  });

  describe("reconcile", () => {
    const body = "Policy-Semver-PR: 7\nPolicy-Semver-Kind: minor";

    async function botCommit(
      remote: string,
      files: Record<string, string>,
    ): Promise<void> {
      const seed = await clone(remote);
      for (const [rel, content] of Object.entries(files)) {
        await writeFile(path.join(seed, rel), content);
      }
      await git(seed, "add", "-A");
      await git(
        seed,
        "-c",
        "user.name=github-actions[bot]",
        "commit",
        "--quiet",
        "-m",
        `chore(release): v1.1.0 [skip version]\n\n${body}`,
      );
      await git(seed, "push", "--quiet", "origin", "main");
    }

    it("refuses a tag that points away from the bump commit", async () => {
      const remote = await makeRemote(app());
      await git(remote, "tag", "v1.1.0", "main");
      await botCommit(remote, {
        VERSION: "1.1.0\n",
        "CHANGELOG.md": "## [1.1.0] - 2026-01-01\n\n- x\n",
      });
      await workspace(remote);
      await merged();
      expect(failure()).toContain("v1.1.0");
      expect(mocks.octokit.rest.repos.createRelease).not.toHaveBeenCalled();
    });

    it("refuses to publish an empty Release (I5)", async () => {
      const remote = await makeRemote(app());
      await botCommit(remote, {
        VERSION: "1.1.0\n",
        "CHANGELOG.md": "# Changelog\n",
      });
      await git(remote, "tag", "v1.1.0", "main");
      await workspace(remote);
      await merged();
      expect(failure()).toContain("1.1.0");
      expect(mocks.octokit.rest.repos.createRelease).not.toHaveBeenCalled();
    });
  });

  describe("text that reaches the changelog", () => {
    it("a subject quoting the next heading still writes the section", async () => {
      const remote = await makeRemote(app());
      const cwd = await workspace(remote);
      await land(remote, {
        "CHANGELOG.md":
          "# Changelog\n\n## [1.0.0] - 2026-01-01\n\n- how ## [1.1.0] works\n",
      });
      await merged();
      expectReleased();
      expect(await readFile(path.join(cwd, "CHANGELOG.md"), "utf8")).toMatch(
        /^## \[1\.1\.0\] - /m,
      );
    });

    it("a subject quoting conflict markers does not block the next release", async () => {
      const remote = await makeRemote(app());
      await workspace(remote);
      commitsAre("fix: handle <<<<<<< and >>>>>>> in input");
      await merged({ title: "fix: markers" });
      expectReleased();

      await workspace(remote);
      commitsAre("fix: next");
      await merged({ number: 8, title: "fix: next" });
      expectReleased();
      expect(await remoteTags(remote)).toEqual(["v1.0.1", "v1.0.2"]);
    });

    it("real conflict markers still fail", async () => {
      const remote = await makeRemote(
        app(
          {},
          { "CHANGELOG.md": "<<<<<<< HEAD\n- a\n=======\n- b\n>>>>>>> x\n" },
        ),
      );
      await workspace(remote);
      await merged();
      expect(failure()).toContain("conflict markers");
    });

    it.fails("keeps CRLF line endings in the changelog", async () => {
      const raw = "# Changelog\r\n\r\n## [1.0.0] - 2026-01-01\r\n\r\n- a\r\n";
      const remote = await makeRemote(app({}, { "CHANGELOG.md": raw }));
      const cwd = await workspace(remote);
      await merged();
      expectReleased();
      const after = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
      expect(after.replace(/\r\n/g, "")).not.toContain("\n");
    });
  });

  describe("skip markers and signals", () => {
    it("an unticked checkbox in the PR body does not cancel the release", async () => {
      const remote = await makeRemote(app());
      await workspace(remote);
      await merged({ body: "## Options\n- [ ] [skip version]\n" });
      expectReleased();
    });

    it("a ticked checkbox does", async () => {
      const remote = await makeRemote(app());
      await workspace(remote);
      await merged({ body: "- [x] [skip version]\n" });
      expect(output("released")).toBe("false");
      expect(await remoteTags(remote)).toEqual([]);
    });

    it("a squash suffix after the marker still skips", async () => {
      const remote = await makeRemote(app());
      await workspace(remote);
      commitsAre("chore: x [skip version] (#12)");
      await merged({ title: "chore: x" });
      expect(await remoteTags(remote)).toEqual([]);
    });

    it("a merged fork PR warns that it was not released (I7)", async () => {
      const remote = await makeRemote(app());
      await workspace(remote);
      await merged({
        head: { ref: "feature", repo: { full_name: "someone/r" } },
      });
      expect(await remoteTags(remote)).toEqual([]);
      expect(String(mocks.core.warning.mock.calls)).toMatch(/not released/i);
    });
  });

  describe("secrets", () => {
    it("does not echo the value of the major env var (I6)", async () => {
      const remote = await makeRemote(app({ majorEnv: "SOME_SECRET" }));
      await workspace(remote);
      process.env.SOME_SECRET = "hunter2hunter2";
      setEvent("opened", pullRequest());
      const thrown = await runAction().catch((err: Error) => err.message);
      delete process.env.SOME_SECRET;
      expect(thrown).toContain("SOME_SECRET");
      expect(thrown).not.toContain("hunter2hunter2");
    });

    it("hooks do not inherit ambient tokens (I6)", async () => {
      const dir = await mkdtemp(path.join(tmpdir(), "ps-env-"));
      const out = path.join(dir, "env");
      const remote = await makeRemote(
        app({ hooks: { beforeBump: `env > ${out}` } }),
      );
      await workspace(remote);
      for (const name of [
        "GITHUB_TOKEN",
        "GH_TOKEN",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
        "ACTIONS_RUNTIME_TOKEN",
      ]) {
        process.env[name] = `leak-${name}`;
      }
      await merged();
      const env = await readFile(out, "utf8");
      for (const name of [
        "GITHUB_TOKEN",
        "GH_TOKEN",
        "ACTIONS_ID_TOKEN_REQUEST_TOKEN",
        "ACTIONS_RUNTIME_TOKEN",
      ]) {
        delete process.env[name];
        expect(env).not.toContain(`leak-${name}`);
      }
    });
  });
});
