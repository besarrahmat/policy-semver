import { BOT_SKIP_TRAILER } from "../bump/locks.js";
import { defaultGitExec } from "./exec.js";
import type { CommitBumpInput } from "./types.js";

/** GitHub Actions runner has no user.identity — commit would fail with empty ident. */
export const BOT_NAME = "github-actions[bot]";
const BOT_EMAIL = "41898282+github-actions[bot]@users.noreply.github.com";
/** Per command, so a run never rewrites the identity in `.git/config`. */
export const BOT_IDENTITY_ARGS = [
  "-c",
  `user.name=${BOT_NAME}`,
  "-c",
  `user.email=${BOT_EMAIL}`,
];

export async function commitBumpFiles(input: CommitBumpInput): Promise<void> {
  if (!input.message.includes(BOT_SKIP_TRAILER)) {
    throw new Error(`commit message missing ${BOT_SKIP_TRAILER}`);
  }
  const exec = input.exec ?? defaultGitExec;
  const cwd = { cwd: input.cwd };
  await exec(["add", "--", ...input.paths], cwd);
  // The bot's commit is not the consumer's to lint or sign: husky, commitlint, or
  // a signing key the runner lacks must not stop a release.
  await exec(
    [
      ...BOT_IDENTITY_ARGS,
      "commit",
      "--no-verify",
      "--no-gpg-sign",
      "-m",
      input.message,
    ],
    cwd,
  );
}
