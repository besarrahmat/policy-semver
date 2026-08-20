import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ClassifyCommit } from "@policy-semver/core";

const execFileAsync = promisify(execFile);

/**
 * Load recent commits from git (thin adapter — no classify).
 * Used when there is no PR (e.g. merge_group) or the API list is empty.
 */
export async function loadCommitsFromGit(
  cwd: string,
): Promise<ClassifyCommit[]> {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["log", "-n", "50", "--pretty=format:%s%x00%b%x1e"],
      { cwd, encoding: "utf8" },
    );
    return stdout
      .split("\x1e")
      .map((chunk) => chunk.replace(/^\n+/, "").trimEnd())
      .filter(Boolean)
      .map((chunk) => {
        const [subjectRaw, bodyRaw = ""] = chunk.split("\x00");
        const subject = (subjectRaw ?? "").trim();
        const body = bodyRaw.trim();
        return {
          subject,
          ...(body.length > 0 ? { body } : {}),
        };
      })
      .filter((c) => c.subject.length > 0);
  } catch {
    return [];
  }
}
