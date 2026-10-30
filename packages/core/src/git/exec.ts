import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { GitExec } from "./types.js";

const execFileAsync = promisify(execFile);

/** A hung remote must fail the job, not hold the release queue open. */
const GIT_TIMEOUT_MS = 5 * 60 * 1000;

export const defaultGitExec: GitExec = async (args, opts) => {
  const { stdout, stderr } = await execFileAsync("git", args, {
    cwd: opts?.cwd,
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
    timeout: GIT_TIMEOUT_MS,
  });
  return { stdout: String(stdout), stderr: String(stderr) };
};
