import { BOT_IDENTITY_ARGS } from "./commit.js";
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

/** Fail while nothing is written yet if the tag is taken locally or remotely. */
export async function assertTagAvailable(input: {
  cwd: string;
  tag: string;
  remote?: string;
  exec?: TagInput["exec"];
}): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  if (await tagExists(input.cwd, input.tag, exec)) {
    throw new Error(`tag already exists: ${input.tag}`);
  }
  await assertRemoteTagCompatible(input);
}

/** Annotated tag; fail if tag already exists (no overwrite). */
export async function createAnnotatedTag(input: TagInput): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  await assertTagAvailable(input);
  await exec(
    [
      ...BOT_IDENTITY_ARGS,
      "tag",
      "-a",
      "--no-sign",
      input.tag,
      "-m",
      input.message,
    ],
    { cwd: input.cwd },
  );
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

/** Commit a remote tag points at (peeled for annotated tags), or null if absent. */
export async function remoteTagSha(input: {
  cwd: string;
  tag: string;
  remote?: string;
  exec?: TagInput["exec"];
}): Promise<string | null> {
  const exec = input.exec ?? defaultGitExec;
  const remote = input.remote ?? "origin";
  const ref = `refs/tags/${input.tag}`;
  const { stdout } = await exec(
    ["ls-remote", "--tags", remote, ref, `${ref}^{}`],
    { cwd: input.cwd },
  );
  const lines = stdout
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const peeled = lines.find((l) => l.endsWith(`${ref}^{}`));
  const direct = lines.find((l) => l.endsWith(ref));
  return (peeled ?? direct)?.split(/\s/)[0] ?? null;
}

export async function assertRemoteTagCompatible(input: {
  cwd: string;
  tag: string;
  remote?: string;
  exec?: TagInput["exec"];
}): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  const remoteSha = await remoteTagSha(input);
  if (!remoteSha) return;

  const headSha = (
    await exec(["rev-parse", "HEAD"], { cwd: input.cwd })
  ).stdout.trim();

  if (remoteSha === headSha) {
    throw new Error(`tag already exists: ${input.tag}`);
  }
  throw new Error(
    `mirror tag conflict: ${input.tag} remote=${remoteSha} local HEAD=${headSha}`,
  );
}
