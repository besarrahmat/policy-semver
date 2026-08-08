import { BOT_SKIP_TRAILER } from "./locks.js";
import type { BumpGuardContext, BumpGuardDecision } from "./types.js";

export function decideBumpGuards(ctx: BumpGuardContext): BumpGuardDecision {
  const reasons: string[] = [];
  let allowWrite = true;
  let forceKindNone = false;

  // fork never write
  if (ctx.isFork) {
    allowWrite = false;
    reasons.push("fork: allowWrite=false");
  }

  // sync-from-prod: base=develop AND head=prod, or explicit sync label
  // Do NOT treat skip-version as sync (that is handled below).
  const hasSyncLabel = (ctx.labels ?? []).some(
    (l) => l.toLowerCase() === "sync-from-prod",
  );
  const isSyncFromProd =
    hasSyncLabel ||
    (ctx.baseBranch === ctx.developBranch && ctx.headBranch === ctx.prodBranch);

  if (isSyncFromProd) {
    allowWrite = false;
    forceKindNone = true;
    reasons.push("sync-from-prod: force none / no write");
  }

  // only prod base may write
  if (ctx.baseBranch !== ctx.prodBranch) {
    allowWrite = false;
    reasons.push("non-prod base: no write");
  }

  // until merged to prod, deny write (callers also pass dryRun: true)
  if (ctx.isMergedToProd === false) {
    allowWrite = false;
    reasons.push("not merged to prod: dry-run only");
  }

  // skip labels
  const skipLabels = (ctx.skipLabels ?? ["skip-version"]).map((s) =>
    s.toLowerCase(),
  );
  if ((ctx.labels ?? []).some((l) => skipLabels.includes(l.toLowerCase()))) {
    allowWrite = false;
    forceKindNone = true;
    reasons.push("skip label");
  }

  // [skip version] (or configured trailers) in subject/body/title
  const trailers = ctx.skipTrailers ?? ["skip version"];
  const patterns = trailers.map(
    (t) => new RegExp(`\\[${escapeRegExp(t)}\\]`, "i"),
  );
  const trailerInner = BOT_SKIP_TRAILER.slice(1, -1);
  if (!trailers.some((t) => t.toLowerCase() === trailerInner.toLowerCase())) {
    patterns.push(new RegExp(`\\[${escapeRegExp(trailerInner)}\\]`, "i"));
  }

  for (const text of ctx.textsForSkip ?? []) {
    if (patterns.some((re) => re.test(text))) {
      allowWrite = false;
      forceKindNone = true;
      reasons.push("skip trailer in subject/body");
      break;
    }
  }

  return { allowWrite, forceKindNone, reasons };
}

export function assertBotCommitMessageSafe(message: string): void {
  if (!message.includes(BOT_SKIP_TRAILER)) {
    throw new Error(`bot commit message missing ${BOT_SKIP_TRAILER}`);
  }
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
