import { defaultGitExec } from "./exec.js";
import type { TagInput } from "./types.js";

export async function tagExists(
  cwd: string,
  tag: string,
  exec = defaultGitExec,
): Promise<boolean> {
  try {
    await exec(["rev-parse", "-q", "--verify", `refs/tags/${tag}`], {
      cwd,
    });
    return true;
  } catch {
    return false;
  }
}

/** Annotated tag; fail if tag already exists (no overwrite). */
export async function createAnnotatedTag(input: TagInput): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  if (await tagExists(input.cwd, input.tag, exec)) {
    throw new Error(`tag already exists: ${input.tag}`);
  }
  await exec(["tag", "-a", input.tag, "-m", input.message], {
    cwd: input.cwd,
  });
}
