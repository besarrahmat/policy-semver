import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { redactSecrets } from "../github/redact.js";
import { mapCommitsToSections, renderReleaseSection } from "./map-commits.js";
import type { WriteChangelogInput, WriteChangelogResult } from "./types.js";

const DEFAULT_HEADER = `# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

`;

function headingFor(version: string): string {
  return `## [${version}]`;
}

function insertAfterUnreleasedOrHeader(
  existing: string,
  section: string,
): string {
  const unreleased = /^## \[Unreleased\][^\n]*\n/m;
  const m = unreleased.exec(existing);
  if (m && m.index !== undefined) {
    const at = m.index + m[0].length;
    return `${existing.slice(0, at)}\n${section}${existing.slice(at)}`;
  }
  const firstRelease = /^## \[/m.exec(existing);
  if (firstRelease && firstRelease.index !== undefined) {
    return `${existing.slice(0, firstRelease.index)}${section}\n${existing.slice(firstRelease.index)}`;
  }
  return `${existing.trimEnd()}\n\n${section}`;
}

/**
 * Append a Keep a Changelog release section (or create the file).
 * Section body is redacted before write.
 *
 * conflict stub: on write failure, retry once with the same content; second
 * failure throws. Does not detect git merge conflict markers yet — fail loud.
 */
export async function writeChangelog(
  input: WriteChangelogInput,
): Promise<WriteChangelogResult> {
  const rel = input.changelogPath;
  const abs = path.join(input.cwd, rel);
  const attempt = input.attempt ?? 1;

  if (input.kind === "none") {
    return { wrote: false, reason: "kind-none", path: abs };
  }

  const buckets = mapCommitsToSections(input.commits);
  const majorNote =
    input.kind === "major-reset"
      ? `Major reset to ${input.version} via majorEnv`
      : undefined;
  const sectionMarkdown = redactSecrets(
    renderReleaseSection({
      version: input.version,
      date: input.date,
      buckets,
      ...(majorNote !== undefined ? { majorNote } : {}),
    }),
  );

  let previous: string | null = null;
  try {
    previous = await readFile(abs, "utf8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }

  if (previous?.includes(headingFor(input.version))) {
    return {
      wrote: false,
      reason: "already-present",
      path: abs,
      sectionMarkdown,
    };
  }

  const next =
    previous === null
      ? DEFAULT_HEADER + sectionMarkdown
      : insertAfterUnreleasedOrHeader(previous, sectionMarkdown);

  try {
    if (attempt > 2) {
      throw new Error(`VE-38 CHANGELOG conflict after retry: ${abs}`);
    }
    await writeFile(abs, next, "utf8");
  } catch (err) {
    if (err instanceof Error && /VE-38/.test(err.message)) throw err;
    if (attempt === 1) {
      // Stub retry (same content). Real flock / dirty-merge detection later.
      return writeChangelog({ ...input, attempt: 2 });
    }
    throw new Error(
      `VE-38 CHANGELOG write failed: ${abs}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  return {
    wrote: true,
    reason: previous === null ? "created" : "appended",
    path: abs,
    sectionMarkdown,
  };
}
