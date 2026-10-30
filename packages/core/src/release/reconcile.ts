import {
  RELEASE_KIND_TRAILER,
  RELEASE_PR_TRAILER,
} from "../bump/bot-message.js";
import type { VersionFiles } from "../bump/types.js";
import { extractReleaseSection } from "../changelog/extract-section.js";
import { CLASSIFY_KINDS, type ClassifyKind } from "../classify/locks.js";
import { readVersionAtRef } from "../dual-source/read-at-ref.js";
import { BOT_NAME } from "../git/commit.js";
import { defaultGitExec } from "../git/exec.js";
import { remoteTagSha } from "../git/tag.js";
import {
  type CreateReleaseInput,
  createGitHubRelease,
  releaseExists,
} from "../github/create-release.js";
import { runHook } from "../hooks/run-hook.js";

export type ReleaseCommit = { sha: string; kind: ClassifyKind };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** The bump commit a previous run made for this PR, or null if it never landed. */
export async function findReleaseCommit(input: {
  cwd: string;
  ref: string;
  prNumber: number;
}): Promise<ReleaseCommit | null> {
  const { stdout } = await defaultGitExec(
    [
      "log",
      input.ref,
      "-n",
      "1",
      "-E",
      `--grep=^${RELEASE_PR_TRAILER}: ${input.prNumber}$`,
      `--author=${escapeRegExp(BOT_NAME)}`,
      "--format=%H%x00%B",
    ],
    { cwd: input.cwd },
  );
  const [sha, body = ""] = stdout.trim().split("\0");
  if (!sha) return null;

  const kind = new RegExp(`^${RELEASE_KIND_TRAILER}: (.+)$`, "m").exec(
    body,
  )?.[1] as ClassifyKind | undefined;
  if (kind === undefined || !CLASSIFY_KINDS.includes(kind)) {
    throw new Error(`release commit ${sha} has no valid kind trailer`);
  }
  return { sha, kind };
}

type ReconcileInput = {
  cwd: string;
  commit: ReleaseCommit;
  files: VersionFiles;
  tagPrefix: string;
  changelogPath: string;
  owner: string;
  repo: string;
  octokit: CreateReleaseInput["octokit"];
  afterRelease: string | null;
};

/**
 * Finish a release whose bump commit already landed: publish the GitHub Release
 * if it is missing, then run `afterRelease` (at-least-once, so it must be
 * idempotent). Never bumps; the push is atomic, so a missing tag means someone
 * removed it and only a human can tell whether it should come back.
 */
export async function reconcileRelease(input: ReconcileInput): Promise<{
  version: string;
  tag: string;
  releaseCreated: boolean;
}> {
  const { sha, kind } = input.commit;

  const version = await readVersionAtRef({
    cwd: input.cwd,
    ref: sha,
    files: input.files,
  });
  if (version === null) {
    throw new Error(`no version files found at release commit ${sha}`);
  }
  const tag = `${input.tagPrefix}${version}`;

  const tagSha = await remoteTagSha({ cwd: input.cwd, tag });
  if (tagSha === null) {
    throw new Error(
      `release commit ${sha} is on the branch but tag ${tag} is missing on the remote; restore the tag, then rerun`,
    );
  }

  const target = {
    owner: input.owner,
    repo: input.repo,
    tag,
    octokit: input.octokit,
  };
  const releaseCreated = !(await releaseExists(target));
  if (releaseCreated) {
    const { stdout: changelog } = await defaultGitExec(
      ["show", `${sha}:${input.changelogPath}`],
      { cwd: input.cwd },
    );
    await createGitHubRelease({
      ...target,
      body: extractReleaseSection(changelog, version),
    });
  }

  await runHook({
    name: "afterRelease",
    command: input.afterRelease,
    cwd: input.cwd,
    version,
    kind,
    dryRun: false,
  });

  return { version, tag, releaseCreated };
}
