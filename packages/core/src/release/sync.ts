import { defaultGitExec } from "../git/exec.js";

/**
 * Move the checkout to the tip of the remote branch before anything is decided
 * or written. A queued job's checkout predates earlier releases, so bumping from
 * it would compute a stale version and have its push rejected.
 */
export async function syncToRemoteBranch(input: {
  cwd: string;
  branch: string;
  /** Fail unless this commit is part of the branch (the merged PR). */
  mustContain?: string;
}): Promise<void> {
  const exec = defaultGitExec;
  const remote = "origin";
  const cwd = { cwd: input.cwd };
  const remoteRef = `${remote}/${input.branch}`;

  const shallow = await exec(["rev-parse", "--is-shallow-repository"], cwd);
  if (shallow.stdout.trim() === "true") {
    throw new Error(
      "shallow checkout: set `fetch-depth: 0` on actions/checkout so reruns can find earlier releases",
    );
  }
  await exec(
    ["fetch", remote, `+refs/heads/${input.branch}:refs/remotes/${remoteRef}`],
    cwd,
  );
  await exec(["checkout", "--quiet", "--detach", remoteRef], cwd);

  if (input.mustContain !== undefined) {
    try {
      await exec(
        ["merge-base", "--is-ancestor", input.mustContain, remoteRef],
        cwd,
      );
    } catch {
      throw new Error(
        `merged commit ${input.mustContain} is not on ${remoteRef}`,
      );
    }
  }
}
