/**
 * GitHub Release + Octokit + redact locks
 *
 * ## Octokit client
 * | Surface | Library | Notes |
 * | --- | --- | --- |
 * | GitHub Action | `@actions/github` | Preferred in Action — `getOctokit(token)` already wired to Actions toolkit |
 *
 * Do **not** re-implement HTTP to api.github.com by hand.
 * Module `packages/core/src/github/` owns Release API calls — must not own file formats
 * (changelog text comes from `changelog/`; version files from `bump/`).
 *
 * ## Tag + Release
 * - Annotated tag `{tagPrefix}{version}` (default `vX.Y.Z`)
 * - If tag already exists → **fail** (no overwrite)
 * - Create GitHub Release with body = changelog section for that version (after redact)
 * - kind `none` → no commit, no tag, no release
 *
 * ## Secret redact — apply to changelog section + release body + logs
 * `writeChangelog` redacts before disk write; `createGitHubRelease` redacts again;
 * hook output and write-failure messages are redacted before they are logged.
 * Never log raw secrets. Unit-test with **fake** strings only.
 */
export const GITHUB_RELEASE_CLIENT = {
  action: "@actions/github",
} as const;

/** Patterns replaced with a redaction marker before release/changelog publish. */
export const SECRET_REDACT_PATTERNS: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{20,}\b/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  // Token-shaped only: "Bearer tokens are documented" is ordinary changelog prose.
  /\bBearer\s+(?:[A-Za-z.]*[0-9_~+/=-][A-Za-z0-9._~+/=-]*|[A-Za-z]{20,})/gi,
  // Any value counts as a header: "Basic authentication" alone is prose.
  /\bAuthorization:\s*(?:Basic|Bearer|token)\s+[A-Za-z0-9._~+/=-]+/gi,
  // Credentials in a git remote URL, as git prints them in error messages.
  /(?<=:\/\/)[^\s/:@]+:[^\s/@]+(?=@)/g,
];

export const SECRET_REDACT_REPLACEMENT = "[REDACTED]" as const;
