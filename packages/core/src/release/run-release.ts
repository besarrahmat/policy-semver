import {
  lastReleaseRelPath,
  writeLastRelease,
} from "../audit/write-last-release.js";
import { formatBotBumpCommitMessage } from "../bump/bot-message.js";
import type { ClassifyKind } from "../classify/locks.js";
import { commitBumpFiles } from "../git/commit.js";
import { defaultGitExec } from "../git/exec.js";
import { pushRefs } from "../git/push.js";
import { createAnnotatedTag } from "../git/tag.js";
import type { GitExec } from "../git/types.js";
import {
  type CreateReleaseInput,
  createGitHubRelease,
} from "../github/create-release.js";
import { runHook } from "../hooks/run-hook.js";
import type { HookExec } from "../hooks/types.js";

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
  /** `null` / omit hook keys → skip. `beforeBump` is owned by write callers, not here. */
  hooks?: {
    afterTag: string | null;
    afterRelease: string | null;
  };
  /** Recorded on the bump commit so a rerun of this PR can find its release. */
  prNumber?: number;
  exec?: GitExec;
  hookExec?: HookExec;
  /** Test seams */
  commit?: typeof commitBumpFiles;
  tag?: typeof createAnnotatedTag;
  push?: typeof pushRefs;
  release?: typeof createGitHubRelease;
  /** Test seam; default writes `.policy-semver/last-release.json`. */
  writeAudit?: typeof writeLastRelease;
  now?: () => Date;
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

/** A consumer may gitignore the audit file; `git add` would refuse it. */
async function isGitIgnored(
  cwd: string,
  rel: string,
  exec: GitExec = defaultGitExec,
): Promise<boolean> {
  try {
    await exec(["check-ignore", "--quiet", rel], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * After version + changelog files are written:
 * last-release.json → commit → annotated tag → afterTag → atomic push of
 * HEAD:{branch} + tag → GitHub Release → afterRelease.
 * Nothing is public before the push, and a failure after it is finished by
 * `reconcileRelease` on rerun.
 * kind `none` → no commit, no tag, no push, no release, no audit.
 */
export async function runRelease(
  input: RunReleaseInput,
): Promise<RunReleaseResult> {
  const kind = input.kind;
  if (kind === "none") {
    return { skipped: true, reason: "kind-none" };
  }

  const tagPrefix = input.tagPrefix ?? "v";
  const tag = `${tagPrefix}${input.version}`;
  const message = formatBotBumpCommitMessage(
    input.version,
    tagPrefix,
    input.prNumber !== undefined
      ? { prNumber: input.prNumber, kind }
      : undefined,
  );

  const commit = input.commit ?? commitBumpFiles;
  const tagFn = input.tag ?? createAnnotatedTag;
  const push = input.push ?? pushRefs;
  const release = input.release ?? createGitHubRelease;

  const writeAudit = input.writeAudit ?? writeLastRelease;
  await writeAudit({
    cwd: input.cwd,
    version: input.version,
    kind,
    tag,
    at: (input.now ?? (() => new Date()))().toISOString(),
  });
  const auditPath = lastReleaseRelPath();
  const auditIgnored = await isGitIgnored(input.cwd, auditPath, input.exec);

  await commit({
    cwd: input.cwd,
    message,
    paths: auditIgnored ? input.paths : [...input.paths, auditPath],
    ...(input.exec !== undefined ? { exec: input.exec } : {}),
  });

  await tagFn({
    cwd: input.cwd,
    tag,
    message: tag,
    ...(input.remote !== undefined ? { remote: input.remote } : {}),
    ...(input.exec !== undefined ? { exec: input.exec } : {}),
  });

  if (input.hooks) {
    await runHook({
      name: "afterTag",
      command: input.hooks.afterTag,
      cwd: input.cwd,
      version: input.version,
      kind,
      dryRun: false,
      ...(input.hookExec !== undefined ? { exec: input.hookExec } : {}),
    });
  }

  // HEAD:branch — PR checkout is often detached; pushing the local
  // branch name would miss the bump commit.
  const branchRef = `HEAD:${input.branch}`;

  await push({
    cwd: input.cwd,
    refs: [branchRef, tag],
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

  if (input.hooks) {
    await runHook({
      name: "afterRelease",
      command: input.hooks.afterRelease,
      cwd: input.cwd,
      version: input.version,
      kind,
      dryRun: false,
      ...(input.hookExec !== undefined ? { exec: input.hookExec } : {}),
    });
  }

  return {
    skipped: false,
    tag,
    committed: true,
    pushed: true,
    released: true,
  };
}
