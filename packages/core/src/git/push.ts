import { defaultGitExec } from "./exec.js";
import type { PushInput } from "./types.js";

/** Push refs (e.g. `HEAD:main` + tag). Token/permissions = caller env. */
export async function pushRefs(input: PushInput): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  const remote = input.remote ?? "origin";
  await exec(["push", remote, ...input.refs], { cwd: input.cwd });
}
