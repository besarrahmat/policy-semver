import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import {
    applyBump,
    classify,
    decideBumpGuards,
    loadConfig,
    readVersion,
    writeChangelog,
    writeVersion,
} from "@policy-semver/core";
import path from "node:path";
import { decideActionMode } from "./decision.js";
import { upsertStickyComment } from "./sticky-comment.js";
import { toVersionFiles } from "./version-files.js";
import { runWriteRelease } from "./write-release.js";

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

/** Phase 7 fills hooks + last-release.json — keep node so 6.B0 flowchart stays honest. */
async function afterWriteAudit(_info: {
    version: string;
    kind: string;
}): Promise<void> {
    core.info("audit/hooks deferred to Phase 7");
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
    const config = await loadConfig(path.join(cwd, configPath));
    const files = toVersionFiles(config.versionFiles);

    const payload = context.payload as {
        pull_request?: {
            number: number;
            merged?: boolean;
            title?: string;
            body?: string | null;
            labels?: { name: string }[];
            base?: { ref: string };
            head?: { ref: string; repo?: { fork?: boolean } | null };
        };
    };
    const pr = payload.pull_request;
    const isFork = Boolean(pr?.head?.repo?.fork);
    const baseBranch = pr?.base?.ref ?? context.ref.replace(/^refs\/heads\//, "");
    const headBranch = pr?.head?.ref ?? "";
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

    // Commits: prefer PR commits via API when issue number exists; fallback empty
    let commits: { subject: string; body?: string }[] = [];
    const octokit = token ? getOctokit(token) : null;
    if (octokit && pr?.number) {
        const { data } = await octokit.rest.pulls.listCommits({
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

    const currentVersion = await readVersion({ cwd, files });
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

    if (decision.mode === "force-none" || guards.forceKindNone) {
        kind = "none";
    }

    const nextVersion = applyBump({ kind, currentVersion, envMajor });
    const allowWrite =
        decision.allowWrite && guards.allowWrite && decision.mode === "write";
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

    if (decision.mode === "skip") {
        core.info(summary);
        return;
    }

    if (!allowWrite) {
        core.info(summary);
        return;
    }

    if (!token || !octokit) {
        core.setFailed(
            "Write path needs a token with contents:write (and pull-requests:write for comments). " +
            "Set input `token`, or secret POLICY_SEMVER_TOKEN / GitHub App installation token when " +
            "branch protection blocks GITHUB_TOKEN (VE-42).",
        );
        return;
    }

    try {
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

        const paths = [
            ...config.versionFiles,
            config.changelogPath,
        ].filter((p, i, a) => a.indexOf(p) === i);

        if (kind !== "none" && (wrote.wrote || changelog.wrote)) {
            await runWriteRelease({
                kind,
                cwd,
                version: nextVersion,
                tagPrefix: config.tagPrefix,
                paths,
                branch: config.prodBranch,
                sectionMarkdown: changelog.sectionMarkdown ?? "",
                owner: context.repo.owner,
                repo: context.repo.repo,
                token,
            });
            await afterWriteAudit({ version: nextVersion, kind });
        }
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        core.setFailed(
            `Write/push/release failed: ${msg}. ` +
            "If branch protection blocks github-actions, use POLICY_SEMVER_TOKEN (PAT) or a GitHub App " +
            "with contents:write bypass (VE-42).",
        );
    }
}