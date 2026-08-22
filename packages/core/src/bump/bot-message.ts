import { BOT_SKIP_TRAILER } from "./locks.js";

export function formatBotBumpCommitMessage(
  nextVersion: string,
  tagPrefix = "v",
): string {
  return `chore(release): ${tagPrefix}${nextVersion} ${BOT_SKIP_TRAILER}`;
}
// → "chore(release): v1.5.0 [skip version]"
