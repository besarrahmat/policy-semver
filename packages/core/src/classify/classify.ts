import {
  firstLine,
  hasBreakingBang,
  hasBreakingFooter,
  isConventionalSubject,
  isMergeSubject,
  normalizeSubject,
  subjectType,
} from "./subject.js";
import type { ClassifyInput, ClassifyResult } from "./types.js";

function parseMajor(version: string): number {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (Number.isNaN(major)) {
    throw new Error(`invalid currentVersion: ${version}`);
  }
  return major;
}

const BREAKING_WARNING =
  "Breaking change marker detected; major only via APP_VERSION_MAJOR (never auto-major)";

function hasBreakingMarker(input: ClassifyInput): boolean {
  const title = input.prTitle?.trim();
  if (
    title &&
    (hasBreakingBang(normalizeSubject(firstLine(title))) ||
      hasBreakingFooter(title))
  ) {
    return true;
  }
  return input.commits.some(
    (c) =>
      hasBreakingBang(normalizeSubject(firstLine(c.subject))) ||
      // Body may carry the footer; never use body for feat buckets.
      (c.body !== undefined && hasBreakingFooter(c.body)),
  );
}

export function classify(input: ClassifyInput): ClassifyResult {
  const warnings: string[] = [];

  // 1) skip?
  if (input.skip === true) {
    return { kind: "none", warnings };
  }

  const currentMajor = parseMajor(input.currentVersion);
  const envMajor = input.envMajor;

  // 2) envMajor vs current
  if (envMajor != null && envMajor < currentMajor) {
    // prefer fail in bump; classify throws to surface the contract early.
    throw new Error(
      `envMajor ${envMajor} is below current major ${currentMajor}`,
    );
  }
  if (envMajor != null && envMajor > currentMajor) {
    // Flowchart: major-reset → Out (skip BREAKING warn / aggregate).
    return { kind: "major-reset", warnings };
  }
  // unset or equal → continue

  // 3) normalize title + commit subjects → buckets
  const subjects = input.commits
    .map((c) => normalizeSubject(firstLine(c.subject)))
    .filter((s) => s.length > 0 && !isMergeSubject(s));
  const title = normalizeSubject(firstLine(input.prTitle?.trim() ?? ""));
  // A plain title ("Update docs") says nothing the commits do not say better.
  if (
    title.length > 0 &&
    !isMergeSubject(title) &&
    (subjects.length === 0 || isConventionalSubject(title))
  ) {
    subjects.push(title);
  }
  const types = subjects.map(subjectType);

  // 4) BREAKING / type!: → warnings only (never auto-major)
  if (hasBreakingMarker(input)) warnings.push(BREAKING_WARNING);

  // 5) aggregate
  if (types.includes("feat")) return { kind: "minor", warnings };
  if (types.some((t) => t !== "docs")) return { kind: "patch", warnings };
  return { kind: "none", warnings };
}
