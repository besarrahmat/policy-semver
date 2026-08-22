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
  await assertRemoteTagCompatible({
    cwd: input.cwd,
    tag: input.tag,
    ...(input.remote !== undefined ? { remote: input.remote } : {}),
    ...(input.exec !== undefined ? { exec: input.exec } : {}),
  });
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

export async function assertRemoteTagCompatible(input: {
  cwd: string;
  tag: string;
  remote?: string;
  exec?: TagInput["exec"];
}): Promise<void> {
  const exec = input.exec ?? defaultGitExec;
  const remote = input.remote ?? "origin";
  let listed: string;
  try {
    listed = (
      await exec(["ls-remote", "--tags", remote, `refs/tags/${input.tag}`], {
        cwd: input.cwd,
      })
    ).stdout;
  } catch {
    return; // no remote / offline → skip (local tagExists still applies)
  }
  const lines = listed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return;

  const peeled = lines.find((l) => l.endsWith(`refs/tags/${input.tag}^{}`));
  const direct = lines.find((l) => l.endsWith(`refs/tags/${input.tag}`));
  const remoteSha = (peeled ?? direct)?.split(/[\s\t]/)[0];
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
