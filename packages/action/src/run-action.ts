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
  loadConfig,
  readVersion,
  readVersionAtRef,
  reconcileRelease,
  runHook,
  syncToRemoteBranch,
  writeChangelog,
  writeVersion,
} from "@policy-semver/core";
import { decideActionMode } from "./decision.js";
import { loadCommitsFromGit } from "./load-commits.js";
import { upsertStickyComment } from "./sticky-comment.js";
import { toVersionFiles } from "./version-files.js";
import { writeFailureMessage } from "./write-failure.js";
import { runWriteRelease, toReposOctokit } from "./write-release.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function shortRef(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}

function failWrite(err: unknown): void {
  core.setFailed(writeFailureMessage(err));
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
      base?: { ref: string };
      head?: { ref: string; repo?: { fork?: boolean } | null };
    };
    merge_group?: { base_ref?: string; head_ref?: string };
  };
  const pr = payload.pull_request;
  const mergeGroup = payload.merge_group;
  const isFork = Boolean(pr?.head?.repo?.fork);
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

  if (decision.mode === "skip") {
    core.setOutput("kind", "none");
    core.setOutput("next-version", "");
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
  }
  if (commits.length === 0) {
    commits = await loadCommitsFromGit(cwd);
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
        core.setOutput("skipped-reason", "");
        core.info(
          `mode: write\nPR already released as ${done.tag}; GitHub Release ${done.releaseCreated ? "created" : "already present"}`,
        );
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
  const envRaw = process.env[config.majorEnv];
  let envMajor: number | null = null;
  if (envRaw !== undefined && envRaw !== "") {
    envMajor = Number.parseInt(envRaw, 10);
    if (Number.isNaN(envMajor)) {
      throw new Error(`invalid ${config.majorEnv}=${JSON.stringify(envRaw)}`);
    }
  }

  let kind = classify({
    commits,
    ...(pr?.title !== undefined ? { prTitle: pr.title } : {}),
    currentVersion,
    envMajor,
  }).kind;

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
  core.setOutput("skipped-reason", skippedReason);

  const summary = [
    `mode: ${decision.mode}`,
    `kind: ${kind}`,
    `current: ${currentVersion}`,
    `next: ${nextVersion}`,
    skippedReason ? `skipped: ${skippedReason}` : "write: pending/ok",
  ].join("\n");

  if (
    (decision.mode === "dry-run-comment" || decision.mode === "force-none") &&
    octokit &&
    pr?.number
  ) {
    await upsertStickyComment({
      octokit,
      owner: context.repo.owner,
      repo: context.repo.repo,
      issueNumber: pr.number,
      body: `### PolicySemVer (dry-run)\n\`\`\`\n${summary}\n\`\`\``,
    });
  }

  if (!allowWrite || kind === "none") {
    core.info(summary);
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
    });

    const paths = await existingPaths(
      cwd,
      [...config.versionFiles, config.changelogPath].filter(
        (p, i, a) => a.indexOf(p) === i,
      ),
    );

    if (wrote.wrote || changelog.wrote) {
      await runWriteRelease({
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
    }
  } catch (err) {
    failWrite(err);
  }
}
