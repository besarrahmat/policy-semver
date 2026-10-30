import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  firstLine,
  normalizeSubject,
  subjectType,
} from "../classify/subject.js";
import { redactSecrets } from "../github/redact.js";
import { mapCommitsToSections, renderReleaseSection } from "./map-commits.js";
import type {
  SectionBuckets,
  WriteChangelogInput,
  WriteChangelogResult,
} from "./types.js";

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
    // Keep hand-written [Unreleased] items out of the section being released.
    const afterHeading = m.index + m[0].length;
    const next = existing.slice(afterHeading).search(/^## \[/m);
    const at = next === -1 ? existing.length : afterHeading + next;
    const rest = existing.slice(at);
    return `${existing.slice(0, at).trimEnd()}\n\n${section}${rest ? `\n${rest}` : ""}`;
  }
  const firstRelease = /^## \[/m.exec(existing);
  if (firstRelease && firstRelease.index !== undefined) {
    return `${existing.slice(0, firstRelease.index)}${section}\n${existing.slice(firstRelease.index)}`;
  }
  return `${existing.trimEnd()}\n\n${section}`;
}

function bucketsFor(input: WriteChangelogInput): SectionBuckets {
  const buckets = mapCommitsToSections(input.commits);
  const title = normalizeSubject(firstLine(input.prTitle ?? ""));
  const titleType = subjectType(title);
  if (titleType === "feat" || titleType === "fix") {
    const fromTitle = mapCommitsToSections([{ subject: title }]);
    if (titleType === "feat") buckets.Added ??= fromTitle.Added ?? [];
    if (titleType === "fix") buckets.Fixed ??= fromTitle.Fixed ?? [];
  }
  return buckets;
}

/**
 * Append a Keep a Changelog release section (or create the file).
 * Section body is redacted before write.
 *
 * conflict: on write failure, retry once with the same content; second
 * failure throws. Conflict markers in the existing file fail immediately.
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

  const buckets = bucketsFor(input);
  const majorNote =
    input.kind === "major-reset"
      ? `Major reset to ${input.version} via majorEnv`
      : undefined;
  // A released version always says something, even if only docs commits landed.
  if (Object.keys(buckets).length === 0 && majorNote === undefined) {
    buckets.Changed = ["Maintenance release"];
  }
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

  if (previous?.includes("<<<<<<<") || previous?.includes(">>>>>>>")) {
    throw new Error(`CHANGELOG conflict markers in ${abs}`);
  }

  const write = input.writeFile ?? writeFile;
  try {
    await write(abs, next, "utf8");
  } catch (err) {
    if (attempt >= 2) {
      throw new Error(
        `CHANGELOG write failed after retry: ${abs}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return writeChangelog({ ...input, attempt: 2 });
  }

  return {
    wrote: true,
    reason: previous === null ? "created" : "appended",
    path: abs,
    sectionMarkdown,
  };
}
