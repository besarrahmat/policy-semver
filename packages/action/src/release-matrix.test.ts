import { chmod, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runAction } from "./run-action.js";
import {
  git,
  makeRemote,
  mocks,
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

const failUnless = (hook: string) => `test "$FAIL_AT" != ${hook}`;

const APP = {
  VERSION: "1.0.0\n",
  "versioning.config.json": JSON.stringify({
    schemaVersion: "1",
    versionFiles: ["VERSION"],
    hooks: {
      beforeBump: failUnless("beforeBump"),
      afterTag: failUnless("afterTag"),
      afterRelease: failUnless("afterRelease"),
    },
  }),
};

type Failure = { arm(remote: string): Promise<() => Promise<void>> };

const hookFailure = (hook: string): Failure => ({
  arm: async () => {
    process.env.FAIL_AT = hook;
    return async () => {
      delete process.env.FAIL_AT;
    };
  },
});

const failures: Record<string, Failure> = {
  "remote unreachable at sync": {
    arm: async (remote) => {
      await rename(remote, `${remote}.gone`);
      return () => rename(`${remote}.gone`, remote);
    },
  },
  "beforeBump hook": hookFailure("beforeBump"),
  "afterTag hook": hookFailure("afterTag"),
  "push rejected": {
    arm: async (remote) => {
      const hook = path.join(remote, "hooks", "pre-receive");
      await writeFile(hook, "#!/bin/sh\nexit 1\n");
      await chmod(hook, 0o755);
      // A developer's global core.hooksPath would otherwise hide this hook.
      await git(remote, "config", "core.hooksPath", path.dirname(hook));
      return () => rm(hook);
    },
  },
  "release lookup 500": {
    arm: async () => {
      mocks.octokit.rest.repos.getReleaseByTag.mockRejectedValueOnce(
        Object.assign(new Error("boom"), { status: 500 }),
      );
      return async () => {};
    },
  },
  "release create 502": {
    arm: async () => {
      mocks.octokit.rest.repos.createRelease.mockRejectedValueOnce(
        Object.assign(new Error("bad gateway"), { status: 502 }),
      );
      return async () => {};
    },
  },
  "afterRelease hook": hookFailure("afterRelease"),
};

type Published = { tag_name: string; body: string };

/** GitHub remembers a Release across reruns; the default mock always says 404. */
function fakeGitHubReleases(): Published[] {
  const published: Published[] = [];
  mocks.octokit.rest.repos.getReleaseByTag.mockImplementation(
    async ({ tag }: { tag: string }) => {
      if (published.some((r) => r.tag_name === tag)) return {};
      throw Object.assign(new Error("Not Found"), { status: 404 });
    },
  );
  mocks.octokit.rest.repos.createRelease.mockImplementation(
    async (release: Published) => {
      published.push(release);
      return {};
    },
  );
  return published;
}

/** `checkout` is the first run's, made before a failure could block cloning. */
async function runMerged(
  remote: string,
  number = 7,
  checkout?: string,
): Promise<void> {
  process.env.GITHUB_WORKSPACE = checkout ?? (await workspace(remote));
  setEvent("closed", pullRequest({ merged: true, number }));
  await runAction();
}

async function bumpCommits(remote: string, prNumber: number): Promise<number> {
  const log = await git(
    remote,
    "log",
    "main",
    `--grep=^Policy-Semver-PR: ${prNumber}$`,
    "--format=%H",
  );
  return log.split("\n").filter(Boolean).length;
}

/** The release invariants from CONTRIBUTING.md that a finished release must hold. */
async function assertReleased(
  remote: string,
  created: Published[],
  versions: string[],
) {
  expect(await remoteTags(remote)).toEqual(versions.map((v) => `v${v}`));
  expect(created.map((c) => c.tag_name).sort()).toEqual(
    versions.map((v) => `v${v}`),
  );
  for (const version of versions) {
    // I4: the tag holds the version it names.
    expect(await git(remote, "show", `v${version}:VERSION`)).toBe(version);
    // I5: the Release body is the changelog section, and is not empty.
    const body = created.find((c) => c.tag_name === `v${version}`)?.body ?? "";
    expect(body).toContain(`## [${version}]`);
    expect(await git(remote, "show", `v${version}:CHANGELOG.md`)).toContain(
      body.trim(),
    );
  }
}

// Real git subprocesses: each case runs two full releases.
describe("failure + rerun matrix", { timeout: 60_000 }, () => {
  let published: Published[];

  beforeEach(() => {
    resetActionMocks();
    published = fakeGitHubReleases();
    delete process.env.FAIL_AT;
  });
  afterEach(() => {
    delete process.env.FAIL_AT;
  });

  for (const [name, failure] of Object.entries(failures)) {
    it(`${name}: the run fails, and a rerun finishes exactly one release`, async () => {
      const remote = await makeRemote(APP);
      const checkout = await workspace(remote);
      const disarm = await failure.arm(remote);

      await runMerged(remote, 7, checkout);
      expect(mocks.core.setFailed).toHaveBeenCalledOnce();
      await disarm();

      // I2: branch and tag move together, whatever the failure was.
      const landed = await bumpCommits(remote, 7);
      expect(await remoteTags(remote)).toEqual(landed === 1 ? ["v1.1.0"] : []);

      mocks.core.setFailed.mockClear();
      await runMerged(remote);
      expect(mocks.core.setFailed).not.toHaveBeenCalled();

      // I1: one PR, one bump commit.
      expect(await bumpCommits(remote, 7)).toBe(1);
      await assertReleased(remote, published, ["1.1.0"]);
    });

    it(`${name}: a second rerun changes nothing`, async () => {
      const remote = await makeRemote(APP);
      const checkout = await workspace(remote);
      const disarm = await failure.arm(remote);
      await runMerged(remote, 7, checkout);
      await disarm();
      await runMerged(remote);
      const head = await git(remote, "rev-parse", "main");

      mocks.core.setFailed.mockClear();
      await runMerged(remote);

      expect(mocks.core.setFailed).not.toHaveBeenCalled();
      expect(await git(remote, "rev-parse", "main")).toBe(head);
    });
  }

  it("a failed PR rerun after another PR released takes the next version", async () => {
    const remote = await makeRemote(APP);
    const checkout = await workspace(remote);
    const disarm = await failures["push rejected"]?.arm(remote);
    await runMerged(remote, 7, checkout);
    await disarm?.();

    await runMerged(remote, 8);
    await runMerged(remote, 7);

    expect(await bumpCommits(remote, 7)).toBe(1);
    expect(await bumpCommits(remote, 8)).toBe(1);
    await assertReleased(remote, published, ["1.1.0", "1.2.0"]);
  });

  it("a Release lost by one PR is restored after another PR released", async () => {
    const remote = await makeRemote(APP);
    await workspace(remote);
    await failures["release create 502"]?.arm(remote);
    await runMerged(remote, 7);

    await runMerged(remote, 8);
    await runMerged(remote, 7);

    expect(await bumpCommits(remote, 7)).toBe(1);
    await assertReleased(remote, published, ["1.1.0", "1.2.0"]);
  });
});
