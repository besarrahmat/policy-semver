/**
 * Keep a Changelog locks
 *
 * Spec: https://keepachangelog.com/en/1.1.0/
 *
 * ## File shape
 * - Filename: `CHANGELOG.md` (config `changelogPath`, default same)
 * - Header when creating missing file:
 *   `# Changelog` + note based on Keep a Changelog + SemVer
 * - Optional `## [Unreleased]` at top; newest release sections first
 * - Version heading: `## [X.Y.Z] - YYYY-MM-DD` (ISO 8601 date)
 *
 * ## Section types (Keep a Changelog)
 * Added | Changed | Deprecated | Removed | Fixed | Security
 *
 * ## Classifier → section mapping (v1 lock — document in writer)
 * | Classify / commit bucket | Changelog section |
 * | --- | --- |
 * | feat (minor) | ### Added |
 * | other / fix / chore / refactor (patch) | ### Fixed (fixes) or ### Changed (other) — prefer: `fix:`→Fixed, else→Changed |
 * | docs-only / kind `none` | **no** changelog mutation |
 * | major-reset | ### Changed (note major via env) + include feat/fix bullets if any |
 *
 * Omit empty sections. kind `none` → do not touch CHANGELOG.
 * conflict: **stub** — retry write once on I/O failure, then fail loud
 * with `conflict`. Does not yet detect merge conflict markers / flock.
 * section markdown is redacted before disk write (and again for Release).
 */
export const CHANGELOG_FORMAT = "keep-a-changelog@1.1.0" as const;

export const CHANGELOG_SECTIONS = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
] as const;

export type ChangelogSection = (typeof CHANGELOG_SECTIONS)[number];

/** Commit subject bucket → Keep a Changelog H3 (v1). */
export const BUCKET_TO_SECTION = {
  feat: "Added",
  fix: "Fixed",
  other: "Changed",
  docs: null, // never mutate for docs-only / kind none
  "major-note": "Changed",
} as const;
