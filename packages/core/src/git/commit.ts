import { BOT_SKIP_TRAILER } from "../bump/locks.js";
import { defaultGitExec } from "./exec.js";
import type { CommitBumpInput } from "./types.js";

export async function commitBumpFiles(input: CommitBumpInput): Promise<void> {
  if (!input.message.includes(BOT_SKIP_TRAILER)) {
    throw new Error(`commit message missing ${BOT_SKIP_TRAILER}`);
  }
  const exec = input.exec ?? defaultGitExec;
  await exec(["add", "--", ...input.paths], { cwd: input.cwd });
  await exec(["commit", "-m", input.message], { cwd: input.cwd });
}
