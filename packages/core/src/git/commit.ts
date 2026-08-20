import { BOT_SKIP_TRAILER } from "../bump/locks.js";
import { defaultGitExec } from "./exec.js";
import type { CommitBumpInput } from "./types.js";

/** GitHub Actions runner has no user.identity — commit would fail with empty ident. */
const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";

export async function commitBumpFiles(input: CommitBumpInput): Promise<void> {
  if (!input.message.includes(BOT_SKIP_TRAILER)) {
    throw new Error(`commit message missing ${BOT_SKIP_TRAILER}`);
  }
  const exec = input.exec ?? defaultGitExec;
  const cwd = { cwd: input.cwd };
  await exec(["config", "user.name", BOT_NAME], cwd);
  await exec(["config", "user.email", BOT_EMAIL], cwd);
  await exec(["add", "--", ...input.paths], cwd);
  await exec(["commit", "-m", input.message], cwd);
}
