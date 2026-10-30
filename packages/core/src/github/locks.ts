/**
 * GitHub Release + Octokit + redact locks
 *
 * ## Octokit client
 * | Surface | Library | Notes |
 * | --- | --- | --- |
 * | GitHub Action | `@actions/github` | Preferred in Action — `getOctokit(token)` already wired to Actions toolkit |
 * | CLI / core helpers | `@octokit/rest` | Optional if CLI creates releases outside Actions; same REST `repos.createRelease` |
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
  cliOrCore: "@octokit/rest",
} as const;

/** Patterns replaced with a redaction marker before release/changelog publish. */
export const SECRET_REDACT_PATTERNS: readonly RegExp[] = [
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{20,}\b/g,
  /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g,
  /\beyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  // Only as a header: "Basic authentication" is ordinary changelog prose.
  /\bAuthorization:\s*Basic\s+[A-Za-z0-9+/=]+/gi,
  // Credentials in a git remote URL, as git prints them in error messages.
  /(?<=:\/\/)[^\s/:@]+:[^\s/@]+(?=@)/g,
];

export const SECRET_REDACT_REPLACEMENT = "[REDACTED]" as const;

export const TAG_EXISTS_FAILS = true as const;
