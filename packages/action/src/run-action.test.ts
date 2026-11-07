import { access, mkdtemp, writeFile } from "node:fs/promises";
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

// Real git subprocesses: a full release spawns dozens of them.
describe("runAction", { timeout: 30_000 }, () => {
  beforeEach(resetActionMocks);

  it("skips a PR that does not target prod", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent(
      "opened",
      pullRequest({ base: { ref: "dev", repo: { full_name: "o/r" } } }),
    );

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
        head: { ref: "feature", repo: { full_name: "someone/r" } },
      }),
    );

    await runAction();

    expect(await remoteTags(remote)).toEqual([]);
    expect(mocks.octokit.rest.repos.createRelease).not.toHaveBeenCalled();
  });

  it("treats a PR whose head repo was deleted as a fork", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent(
      "closed",
      pullRequest({ merged: true, head: { ref: "feature", repo: null } }),
    );

    await runAction();

    expect(await remoteTags(remote)).toEqual([]);
    expect(mocks.core.warning.mock.calls.flat().join("\n")).toContain(
      "was merged but not released",
    );
  });

  it("releases an internal PR in a repo that is itself a fork", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent(
      "closed",
      pullRequest({
        merged: true,
        head: { ref: "feature", repo: { full_name: "o/r", fork: true } },
      }),
    );

    await runAction();

    expect(await remoteTags(remote)).toEqual(["v1.1.0"]);
  });

  it("warns when the PR reaches GitHub's commit listing limit", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    mocks.octokit.paginate.mockResolvedValue(
      Array.from({ length: 250 }, () => ({ commit: { message: "fix: x" } })),
    );
    setEvent("opened", pullRequest());

    await runAction();

    expect(mocks.core.warning).toHaveBeenCalledOnce();
  });

  it("rejects a typo in the major env var", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    process.env.APP_VERSION_MAJOR = "2abc";
    setEvent("opened", pullRequest());

    await expect(runAction()).rejects.toThrow(/invalid APP_VERSION_MAJOR/);
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
    expect(output("tag")).toBe("v1.1.0");
    expect(output("released")).toBe("true");
    expect(output("current-version")).toBe("1.0.0");
    expect(mocks.core.setSecret).toHaveBeenCalledWith("test-token");
    expect(mocks.core.summary.addCodeBlock.mock.lastCall?.[0]).toContain(
      "released: v1.1.0",
    );
  });

  it("reports a failed release in the outputs and summary", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    mocks.octokit.rest.repos.createRelease.mockRejectedValueOnce(
      new Error("502"),
    );
    setEvent("closed", pullRequest({ merged: true }));

    await runAction();

    expect(output("released")).toBe("false");
    expect(mocks.core.setFailed.mock.calls[0]?.[0]).toContain(
      "GitHub Release: 502",
    );
    expect(mocks.core.summary.addCodeBlock.mock.lastCall?.[0]).toContain(
      "failed: GitHub Release: 502",
    );
  });

  it("still succeeds when the job summary cannot be written", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    mocks.core.summary.write.mockRejectedValueOnce(new Error("no file"));
    setEvent("closed", pullRequest({ merged: true }));

    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(mocks.core.warning).toHaveBeenCalledOnce();
    expect(output("released")).toBe("true");
  });

  it("surfaces a breaking marker as a warning", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    setEvent("opened", pullRequest({ title: "feat!: drop thing" }));

    await runAction();

    expect(mocks.core.warning.mock.calls[0]?.[0]).toMatch(/Breaking change/);
  });

  it("keeps a dry-run green when the PR comment is refused", async () => {
    const remote = await makeRemote();
    await workspace(remote);
    mocks.octokit.rest.issues.listComments.mockRejectedValueOnce(
      new Error("Resource not accessible by integration"),
    );
    setEvent(
      "opened",
      pullRequest({ head: { ref: "f", repo: { full_name: "someone/r" } } }),
    );

    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(mocks.core.warning.mock.calls[0]?.[0]).toMatch(/PR comment/);
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

  it("releases when the merged commit is on prod", async () => {
    const remote = await makeRemote();
    const sha = await git(remote, "rev-parse", "main");
    setEvent("closed", pullRequest({ merged: true, merge_commit_sha: sha }));
    await workspace(remote);
    await runAction();

    expect(mocks.core.setFailed).not.toHaveBeenCalled();
    expect(await remoteTags(remote)).toEqual(["v1.1.0"]);
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

  it("does nothing for a docs-only merge with a plain title", async () => {
    const remote = await makeRemote();
    mocks.octokit.paginate.mockResolvedValue([
      { commit: { message: "docs: readme" } },
    ]);
    setEvent("closed", pullRequest({ merged: true, title: "Update readme" }));
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
