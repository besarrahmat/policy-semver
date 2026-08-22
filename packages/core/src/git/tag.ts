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
  await exec(["tag", "-a", "--no-sign", input.tag, "-m", input.message], {
    cwd: input.cwd,
  });
}

export async function assertTagMatchesVersion(input: {
  cwd: string;
  version: string;
  tagPrefix?: string;
  exec?: TagInput["exec"];
}): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  const prefix = input.tagPrefix ?? "v";
  const want = `${prefix}${input.version}`;
  try {
    const { stdout } = await exec(["rev-parse", "--is-inside-work-tree"], {
      cwd: input.cwd,
    });
    if (stdout.trim() !== "true") return;
  } catch {
    return;
  }
  let listed: string;
  try {
    listed = (await exec(["tag", "-l", `${prefix}*`], { cwd: input.cwd }))
      .stdout;
  } catch {
    return;
  }
  if (listed.trim().length === 0) return;
  if (!(await tagExists(input.cwd, want, exec))) {
    throw new Error(
      `tag missing for VERSION ${input.version}: expected ${want}`,
    );
  }
}
