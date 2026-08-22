import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

/**
 * true if working tree clean (no staged/unstaged/untracked).
 * Non-git / git failure → false (fail closed for --write).
 */
export async function isGitClean(cwd: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync("git", ["status", "--porcelain"], {
      cwd,
      encoding: "utf8",
    });
    return stdout.trim().length === 0;
  } catch {
    return false;
  }
}
