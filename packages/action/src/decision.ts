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
  | { mode: "dry-run-comment"; reason: string }
  | { mode: "skip"; reason: string }
  | { mode: "force-none"; reason: "sync-from-prod" }
  | { mode: "write"; reason: string };

export function decideActionMode(input: DecisionInput): Decision {
  if (input.isFork) {
    return {
      mode: "dry-run-comment",
      reason: "fork: dry-run + comment only",
    };
  }

  // Must run before prod-base check (sync PRs have base=develop)
  if (
    input.baseBranch === input.developBranch &&
    input.headBranch === input.prodBranch
  ) {
    return {
      mode: "force-none",
      reason: "sync-from-prod",
    };
  }

  if (input.baseBranch !== input.prodBranch) {
    return {
      mode: "skip",
      reason: "non-prod base: no write",
    };
  }

  if (input.forceDryRun) {
    return {
      mode: "dry-run-comment",
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
      reason: "pr opened/synchronize/reopened",
    };
  }

  if (
    input.eventName === "pull_request" &&
    action === "closed" &&
    input.merged === true
  ) {
    return { mode: "write", reason: "pr merged to prod" };
  }

  // The queue's SHA is speculative: it may never land. The release happens on
  // the PR's closed+merged event; here the group only gets validated.
  if (input.eventName === "merge_group") {
    return {
      mode: "dry-run-comment",
      reason: "merge_group: dry-run only",
    };
  }

  // push / other → skip (locked: no push-to-prod write)
  return { mode: "skip", reason: "other event" };
}
