/**
 * Read before changing `classify()`:
 *
 * ## Module boundary
 * `classify` is a **pure** function: no `fs`, no git, no `child_process`, no
 * `@actions/*`, no Octokit. Callers supply commits, optional PR title, env major,
 * and current version. SemVer **string math** lives in bump — this
 * module returns `kind` + `warnings` only (no `nextVersion`).
 *
 * ## Buckets (subject / PR title first line only)
 * | Match | Bucket |
 * | --- | --- |
 * | `feat:` / `feat(…):` / `feat!:` / `feat & fix:` / `feat&fix:` | feat → minor |
 * | `docs:` / `docs(…):` | docs |
 * | else (incl. `fix:`, `chore:`, `feature:` typo) | other → patch |
 *
 * Aggregate: ≥1 feat → `minor`; else ≥1 other → `patch`; else docs-only / empty → `none`.
 * Strip leading emoji / ZWJ; match case-insensitive.
 * `APP_VERSION_MAJOR` (env) > current major → `major-reset` wins same run.
 * `BREAKING CHANGE` / `feat!:` → **warning only** — **never** auto-major.
 *
 * ## Cheat sheet
 * | Subject | Bump |
 * | --- | --- |
 * | `feat:` / `feat(scope):` / `feat & fix:` | minor |
 * | `fix:` / `chore:` / `refactor:` | patch |
 * | `docs:` only | none |
 * | major env raised | `N.0.0` |
 * | `[skip version]` / label | none (`skip` input) |
 *
 * ## Classify-related locks (locked)
 * | Cause | Locked behavior |
 * | --- | --- |
 * | `FEAT:` casing | Case-insensitive |
 * | Emoji prefix | Strip then classify |
 * | `feature:` typo | other → patch (not minor) |
 * | Merge subject | Ignore |
 * | feat in body only | Ignore body for buckets |
 * | `docs(scope):` | docs bucket |
 * | `feat&fix:` | Optional spaces around `&` |
 * | Title feat, docs commits | Title in aggregate → minor |
 * | Title docs, feat commit | Commits in aggregate → minor |
 * | Empty commits + empty title | `none` |
 * | Major unset | No major-reset |
 * | Major + docs PR | `major-reset` still wins |
 *
 * `envMajor` < current: classify throws for now; prefer fail in bump.
 */
export const CLASSIFY_KINDS = [
  "major-reset",
  "minor",
  "patch",
  "none",
] as const;

export type ClassifyKind = (typeof CLASSIFY_KINDS)[number];

/** Never promote kind to major from Conventional Commits markers. */
export const CLASSIFY_NEVER_AUTO_MAJOR = true as const;
