import type { ClassifyKind } from "../classify/locks.js";
import { BOT_SKIP_TRAILER } from "./locks.js";

/** Identify which PR a bump commit released, so a rerun never bumps twice. */
export const RELEASE_PR_TRAILER = "Policy-Semver-PR" as const;
export const RELEASE_KIND_TRAILER = "Policy-Semver-Kind" as const;

export function formatBotBumpCommitMessage(
  nextVersion: string,
  tagPrefix = "v",
  source?: { prNumber: number; kind: ClassifyKind },
): string {
  const subject = `chore(release): ${tagPrefix}${nextVersion} ${BOT_SKIP_TRAILER}`;
  if (source === undefined) return subject;
  return `${subject}\n\n${RELEASE_PR_TRAILER}: ${source.prNumber}\n${RELEASE_KIND_TRAILER}: ${source.kind}`;
}
// → "chore(release): v1.5.0 [skip version]"
