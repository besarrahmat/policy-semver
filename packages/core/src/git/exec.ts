import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitExec } from "./types.js";

const execFileAsync = promisify(execFile);

export const defaultGitExec: GitExec = async (args, opts) => {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd: opts?.cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return { stdout: String(stdout), stderr: String(stderr) };
};
