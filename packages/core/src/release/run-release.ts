import { formatBotBumpCommitMessage } from "../bump/bot-message.js";
import type { ClassifyKind } from "../classify/locks.js";
import { commitBumpFiles } from "../git/commit.js";
import { pushRefs } from "../git/push.js";
import { createAnnotatedTag } from "../git/tag.js";
import type { GitExec } from "../git/types.js";
import {
  type CreateReleaseInput,
  createGitHubRelease,
} from "../github/create-release.js";

export type RunReleaseInput = {
  kind: ClassifyKind;
  cwd: string;
  version: string;
  /** Default `v` → tag `vX.Y.Z` */
  tagPrefix?: string;
  /** Paths already written (VERSION, package.json, CHANGELOG.md, …) */
  paths: string[];
  /** Branch ref to push with the tag (e.g. `main` / `dev`) */
  branch: string;
  /** Changelog section markdown for this version (pre-redact OK) */
  sectionMarkdown: string;
  owner: string;
  repo: string;
  octokit: CreateReleaseInput["octokit"];
  remote?: string;
  exec?: GitExec;
  /** Test seams */
  commit?: typeof commitBumpFiles;
  tag?: typeof createAnnotatedTag;
  push?: typeof pushRefs;
  release?: typeof createGitHubRelease;
};

export type RunReleaseResult =
  | { skipped: true; reason: "kind-none" }
  | {
      skipped: false;
      tag: string;
      committed: true;
      pushed: true;
      released: true;
    };

/**
 * After version + changelog files are written: commit → annotated tag → push → Release.
 * kind `none` → no commit, no tag, no push, no release.
 */
export async function runRelease(
  input: RunReleaseInput,
): Promise<RunReleaseResult> {
  if (input.kind === "none") {
    return { skipped: true, reason: "kind-none" };
  }

  const tagPrefix = input.tagPrefix ?? "v";
  const tag = `${tagPrefix}${input.version}`;
  const message = formatBotBumpCommitMessage(input.version, tagPrefix);

  const commit = input.commit ?? commitBumpFiles;
  const tagFn = input.tag ?? createAnnotatedTag;
  const push = input.push ?? pushRefs;
  const release = input.release ?? createGitHubRelease;

  await commit({
    cwd: input.cwd,
    message,
    paths: input.paths,
    ...(input.exec !== undefined ? { exec: input.exec } : {}),
  });

  await tagFn({
    cwd: input.cwd,
    tag,
    message: tag,
    ...(input.exec !== undefined ? { exec: input.exec } : {}),
  });

  await push({
    cwd: input.cwd,
    refs: [input.branch, tag],
    ...(input.remote !== undefined ? { remote: input.remote } : {}),
    ...(input.exec !== undefined ? { exec: input.exec } : {}),
  });

  await release({
    owner: input.owner,
    repo: input.repo,
    tag,
    body: input.sectionMarkdown,
    octokit: input.octokit,
  });

  return {
    skipped: false,
    tag,
    committed: true,
    pushed: true,
    released: true,
  };
}
