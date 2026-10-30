import { defaultGitExec } from "./exec.js";
import type { PushInput } from "./types.js";

/**
 * Push refs (e.g. `HEAD:main` + tag). Token/permissions = caller env.
 * `--atomic`: a rejected branch must not leave a public tag behind.
 */
export async function pushRefs(input: PushInput): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  const remote = input.remote ?? "origin";
  await exec(["push", "--atomic", remote, ...input.refs], { cwd: input.cwd });
}
