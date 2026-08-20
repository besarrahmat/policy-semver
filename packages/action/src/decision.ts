import { ACTION_EVENT } from "./locks.js";

export type DecisionInput = {
    isFork: boolean;
    baseBranch: string;
    headBranch: string;
    prodBranch: string;
    developBranch: string;
    eventName: string;
    /** pull_request action, e.g. opened | synchronize | closed */
    action?: string;
    merged?: boolean;
    /** input dry-run=true forces comment path even on merge */
    forceDryRun?: boolean;
};

export type Decision =
    | { mode: "dry-run-comment"; allowWrite: false; reason: string }
    | { mode: "skip"; allowWrite: false; reason: string }
    | { mode: "force-none"; allowWrite: false; reason: "sync-from-prod" }
    | { mode: "write"; allowWrite: true; reason: string };

export function decideActionMode(input: DecisionInput): Decision {
    if (input.isFork) {
        return {
            mode: "dry-run-comment",
            allowWrite: false,
            reason: "fork: dry-run + comment only",
        };
    }

    // VF-03 — must run before prod-base check (sync PRs have base=develop)
    if (
        input.baseBranch === input.developBranch &&
        input.headBranch === input.prodBranch
    ) {
        return {
            mode: "force-none",
            allowWrite: false,
            reason: "sync-from-prod",
        };
    }

    if (input.baseBranch !== input.prodBranch) {
        return {
            mode: "skip",
            allowWrite: false,
            reason: "non-prod base: no write",
        };
    }

    if (input.forceDryRun) {
        return {
            mode: "dry-run-comment",
            allowWrite: false,
            reason: "input dry-run=true",
        };
    }

    const action = input.action ?? "";
    if (
        input.eventName === "pull_request" &&
        (ACTION_EVENT.dryRunActions as readonly string[]).includes(action)
    ) {
        return {
            mode: "dry-run-comment",
            allowWrite: false,
            reason: "pr opened/synchronize/reopened",
        };
    }

    if (
        input.eventName === "pull_request" &&
        action === "closed" &&
        input.merged === true
    ) {
        return { mode: "write", allowWrite: true, reason: "pr merged to prod" };
    }

    if (
        ACTION_EVENT.mergeGroupIsWrite &&
        input.eventName === "merge_group"
    ) {
        return { mode: "write", allowWrite: true, reason: "merge_group" };
    }

    // push / other → skip (locked: no push-to-prod write)
    return { mode: "skip", allowWrite: false, reason: "other event" };
}