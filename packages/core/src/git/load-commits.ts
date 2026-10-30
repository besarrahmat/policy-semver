import type { ClassifyCommit } from "../classify/types.js";
import { defaultGitExec } from "./exec.js";
import type { GitExec } from "./types.js";

/** Only bounds a first run on a repo with a long untagged history. */
const MAX_COMMITS = 1000;

async function lastTag(
  cwd: string,
  tagPrefix: string,
  exec: GitExec,
): Promise<string | null> {
  try {
    const { stdout } = await exec(
      ["describe", "--tags", "--abbrev=0", `--match=${tagPrefix}[0-9]*`],
      { cwd },
    );
    return stdout.trim() || null;
  } catch {
    return null; // no matching tag yet
  }
}

/**
 * Commits since the last release tag: older ones already shipped and must not
 * affect this classification. Subject + body so BREAKING CHANGE footers reach
 * classify. A git failure throws: an empty list would silently classify `none`.
 */
export async function loadCommitsSinceLastTag(
  cwd: string,
  tagPrefix: string,
  exec: GitExec = defaultGitExec,
): Promise<ClassifyCommit[]> {
  const tag = await lastTag(cwd, tagPrefix, exec);
  const { stdout } = await exec(
    [
      "log",
      `--max-count=${MAX_COMMITS}`,
      "--pretty=format:%s%x00%b%x1e",
      ...(tag !== null ? [`${tag}..HEAD`] : []),
    ],
    { cwd },
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
}
