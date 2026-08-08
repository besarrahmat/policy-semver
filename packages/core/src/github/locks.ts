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
 * ## Secret redact — apply to changelog section + release body
 * `writeChangelog` redacts before disk write; `createGitHubRelease` redacts again.
 * Never log raw secrets. Unit-test with **fake** strings only.
 */
export const GITHUB_RELEASE_CLIENT = {
  action: "@actions/github",
  cliOrCore: "@octokit/rest",
} as const;

/** Patterns replaced with a redaction marker before release/changelog publish. */
export const SECRET_REDACT_PATTERNS: readonly RegExp[] = [
  /\bghp_[A-Za-z0-9]{20,}\b/g,
  /\bgho_[A-Za-z0-9]{20,}\b/g,
  /\bnpm_[A-Za-z0-9]{20,}\b/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
];

export const SECRET_REDACT_REPLACEMENT = "[REDACTED]" as const;

export const TAG_EXISTS_FAILS = true as const;
