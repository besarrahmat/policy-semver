import { access } from "node:fs/promises";
import path from "node:path";
import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
  applyBump,
  assertTagAvailable,
  classify,
  decideBumpGuards,
  findReleaseCommit,
  loadCommitsSinceLastTag,
  loadConfig,
  parseEnvMajor,
  readVersion,
  readVersionAtRef,
  reconcileRelease,
  redactSecrets,
  runHook,
  syncToRemoteBranch,
  toVersionFiles,
  writeChangelog,
  writeVersion,
} from "@policy-semver/core";
import { decideActionMode } from "./decision.js";
import { upsertStickyComment } from "./sticky-comment.js";
import { writeFailureMessage } from "./write-failure.js";
import { runWriteRelease, toReposOctokit } from "./write-release.js";

const PR_COMMITS_API_LIMIT = 250;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function shortRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}

function failWrite(err: unknown): void {
  core.setFailed(writeFailureMessage(err));
}

function errorText(err: unknown): string {
  return redactSecrets(err instanceof Error ? err.message : String(err));
}

/** Reporting must not fail a job whose release already succeeded. */
async function writeJobSummary(text: string): Promise<void> {
  try {
    await core.summary.addHeading("PolicySemVer", 3).addCodeBlock(text).write();
  } catch (err) {
    core.warning(`could not write the job summary: ${errorText(err)}`);
  }
}

/** `versionFiles` may name a file the repo does not have; `git add` would refuse it. */
async function existingPaths(cwd: string, rels: string[]): Promise<string[]> {
  const checked = await Promise.all(
    rels.map(async (rel) => {
      try {
        await access(path.join(cwd, rel));
        return rel;
      } catch {
        return null;
      }
    }),
  );
  return checked.filter((rel) => rel !== null);
}

export async function runAction(): Promise<void> {
  const configPath = core.getInput("config-path") || "versioning.config.json";
  const forceDryRun = core.getBooleanInput("dry-run");
  const token =
    process.env.POLICY_SEMVER_TOKEN?.trim() ||
    core.getInput("token") ||
    process.env.GITHUB_TOKEN ||
    "";
  if (token) core.setSecret(token);

  const cwd = process.env.GITHUB_WORKSPACE || process.cwd();
  let config = await loadConfig(path.join(cwd, configPath));

  const payload = context.payload as {
    pull_request?: {
      number: number;
      merged?: boolean;
      merge_commit_sha?: string | null;
      title?: string;
      body?: string | null;
      labels?: { name: string }[];
      base?: { ref: string; repo?: { full_name?: string } | null };
      head?: { ref: string; repo?: { full_name?: string } | null };
    };
    merge_group?: { base_ref?: string; head_ref?: string };
  };
  const pr = payload.pull_request;
  const mergeGroup = payload.merge_group;
  // Not `head.repo.fork`: that is also true for internal PRs in a repo that is
  // itself a fork. A deleted head repo is null, and can only have been a fork.
  const isFork =
    pr !== undefined && pr.head?.repo?.full_name !== pr.base?.repo?.full_name;
  const baseBranch =
    pr?.base?.ref ??
    (mergeGroup?.base_ref !== undefined
      ? shortRef(mergeGroup.base_ref)
      : shortRef(context.ref));
  const headBranch =
    pr?.head?.ref ??
    (mergeGroup?.head_ref !== undefined ? shortRef(mergeGroup.head_ref) : "");
  const labels = (pr?.labels ?? []).map((l) => l.name);

  const payloadAction =
    typeof context.payload.action === "string"
      ? context.payload.action
      : undefined;
  const decision = decideActionMode({
    isFork,
    baseBranch,
    headBranch,
    prodBranch: config.prodBranch,
    developBranch: config.developBranch,
    eventName: context.eventName,
    ...(payloadAction !== undefined ? { action: payloadAction } : {}),
    ...(pr?.merged !== undefined ? { merged: pr.merged } : {}),
    forceDryRun,
  });

  core.setOutput("tag", "");
  core.setOutput("released", "false");

  if (decision.mode === "skip") {
    core.setOutput("kind", "none");
    core.setOutput("next-version", "");
    core.setOutput("current-version", "");
    core.setOutput("skipped-reason", decision.reason);
    core.info(`mode: skip\nskipped: ${decision.reason}`);
    return;
  }

  let commits: { subject: string; body?: string }[] = [];
  const octokit = token ? getOctokit(token) : null;
  if (octokit && pr?.number) {
    const data = await octokit.paginate(octokit.rest.pulls.listCommits, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: pr.number,
      per_page: 100,
    });
    commits = data.map((c) => {
      const msg = c.commit.message ?? "";
      const [subject = "", ...rest] = msg.split("\n");
      const body = rest.join("\n").trim();
      return { subject, ...(body ? { body } : {}) };
    });
    if (data.length >= PR_COMMITS_API_LIMIT) {
      core.warning(
        `PR has ${PR_COMMITS_API_LIMIT}+ commits; GitHub lists only the first ${PR_COMMITS_API_LIMIT}, so a later feat: may be missed. Use a feat: PR title.`,
      );
    }
  }
  if (commits.length === 0) {
    commits = await loadCommitsSinceLastTag(cwd, config.tagPrefix);
  }

  const guards = decideBumpGuards({
    isFork,
    baseBranch,
    headBranch,
    prodBranch: config.prodBranch,
    developBranch: config.developBranch,
    labels,
    skipLabels: config.skipLabels,
    skipTrailers: config.skipTrailers,
    textsForSkip: [
      ...commits.map((c) => c.subject),
      ...commits.map((c) => c.body ?? ""),
      pr?.title ?? "",
      pr?.body ?? "",
    ],
    isMergedToProd: decision.mode === "write",
  });

  const allowWrite =
    decision.allowWrite && guards.allowWrite && decision.mode === "write";

  if (allowWrite && (!token || !octokit)) {
    core.setFailed(
      "Write path needs a token with contents:write (and pull-requests:write for comments). " +
        "Set input `token`, or secret POLICY_SEMVER_TOKEN / GitHub App installation token when " +
        "branch protection blocks GITHUB_TOKEN.",
    );
    return;
  }

  if (allowWrite) {
    try {
      await syncToRemoteBranch({
        cwd,
        branch: config.prodBranch,
        ...(pr?.merge_commit_sha ? { mustContain: pr.merge_commit_sha } : {}),
      });
      config = await loadConfig(path.join(cwd, configPath));

      const released = pr
        ? await findReleaseCommit({
            cwd,
            ref: `origin/${config.prodBranch}`,
            prNumber: pr.number,
          })
        : null;
      if (released) {
        const done = await reconcileRelease({
          cwd,
          commit: released,
          files: toVersionFiles(config.versionFiles),
          tagPrefix: config.tagPrefix,
          changelogPath: config.changelogPath,
          owner: context.repo.owner,
          repo: context.repo.repo,
          octokit: toReposOctokit(token),
          afterRelease: config.hooks.afterRelease,
        });
        core.setOutput("kind", released.kind);
        core.setOutput("next-version", done.version);
        core.setOutput("current-version", done.version);
        core.setOutput("skipped-reason", "");
        core.setOutput("tag", done.tag);
        core.setOutput("released", "true");
        const finished = `mode: write\nPR already released as ${done.tag}; GitHub Release ${done.releaseCreated ? "created" : "already present"}`;
        core.info(finished);
        await writeJobSummary(finished);
        return;
      }
    } catch (err) {
      failWrite(err);
      return;
    }
  }

  const files = toVersionFiles(config.versionFiles);
  const fromProd = await readVersionAtRef({
    cwd,
    ref: `origin/${config.prodBranch}`,
    files,
  });
  const currentVersion = fromProd ?? (await readVersion({ cwd, files }));
  const envMajor = parseEnvMajor(config.majorEnv, process.env[config.majorEnv]);

  const classified = classify({
    commits,
    ...(pr?.title !== undefined ? { prTitle: pr.title } : {}),
    currentVersion,
    envMajor,
  });
  for (const warning of classified.warnings) core.warning(warning);
  let kind = classified.kind;

  if (decision.mode === "force-none" || guards.forceKindNone) {
    kind = "none";
  }

  const nextVersion = applyBump({ kind, currentVersion, envMajor });
  const skippedReason =
    decision.mode === "write" && allowWrite
      ? ""
      : [decision.reason, ...guards.reasons].filter(Boolean).join("; ");

  core.setOutput("kind", kind);
  core.setOutput("next-version", kind === "none" ? "" : nextVersion);
  core.setOutput("current-version", currentVersion);
  core.setOutput("skipped-reason", skippedReason);

  const summary = [
    `mode: ${decision.mode}`,
    `kind: ${kind}`,
    `current: ${currentVersion}`,
    `next: ${nextVersion}`,
    ...(skippedReason ? [`skipped: ${skippedReason}`] : []),
  ].join("\n");

  if (
    (decision.mode === "dry-run-comment" || decision.mode === "force-none") &&
    octokit &&
    pr?.number
  ) {
    // Fork PRs get a read-only token, so a dry-run must survive a refused comment.
    try {
      await upsertStickyComment({
        octokit,
        owner: context.repo.owner,
        repo: context.repo.repo,
        issueNumber: pr.number,
        body: `### PolicySemVer (dry-run)\n\`\`\`\n${summary}\n\`\`\``,
      });
    } catch (err) {
      core.warning(`could not write the PR comment: ${errorText(err)}`);
    }
  }

  if (!allowWrite || kind === "none") {
    core.info(summary);
    await writeJobSummary(summary);
    return;
  }

  try {
    await assertTagAvailable({
      cwd,
      tag: `${config.tagPrefix}${nextVersion}`,
    });
    await runHook({
      name: "beforeBump",
      command: config.hooks.beforeBump,
      cwd,
      version: nextVersion,
      kind,
      dryRun: false,
    });
    const wrote = await writeVersion({
      cwd,
      nextVersion,
      dryRun: false,
      allowWrite: true,
      files,
    });
    const changelog = await writeChangelog({
      cwd,
      changelogPath: config.changelogPath,
      version: nextVersion,
      date: today(),
      kind,
      commits,
      ...(pr?.title !== undefined ? { prTitle: pr.title } : {}),
    });

    const paths = await existingPaths(
      cwd,
      [...config.versionFiles, config.changelogPath].filter(
        (p, i, a) => a.indexOf(p) === i,
      ),
    );

    if (wrote.wrote || changelog.wrote) {
      const result = await runWriteRelease({
        kind,
        ...(pr ? { prNumber: pr.number } : {}),
        cwd,
        version: nextVersion,
        tagPrefix: config.tagPrefix,
        paths,
        branch: config.prodBranch,
        sectionMarkdown: changelog.sectionMarkdown ?? "",
        owner: context.repo.owner,
        repo: context.repo.repo,
        token,
        hooks: {
          afterTag: config.hooks.afterTag,
          afterRelease: config.hooks.afterRelease,
        },
      });
      if (!result.skipped) {
        core.setOutput("tag", result.tag);
        core.setOutput("released", "true");
        const released = `${summary}\nreleased: ${result.tag}`;
        core.info(released);
        await writeJobSummary(released);
      }
    }
  } catch (err) {
    failWrite(err);
    await writeJobSummary(`${summary}\nfailed: ${errorText(err)}`);
  }
}
