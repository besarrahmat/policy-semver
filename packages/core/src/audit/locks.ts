/**
 * Audit trail. Write only after GitHub Release succeeds (after
 * `afterRelease`). Default: **commit** `.policy-semver/last-release.json`.
 * Do not gitignore unless a consumer wants a local-only trail.
 *
 * gitSha = `git rev-parse HEAD` after the bump commit (tagged commit).
 * The file cannot live in that commit — persist with a follow-up
 * `[skip version]` commit + push of the branch only (do not retag).
 * Dogfood commit of this path in the tool repo is later (not this step).
 */
export const AUDIT_DIR = ".policy-semver" as const;
export const AUDIT_FILE = "last-release.json" as const;
