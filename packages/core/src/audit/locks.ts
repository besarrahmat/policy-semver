/**
 * Audit trail. Written before the bump commit and committed with it, so one
 * release is one commit: a second commit + push could fail after the Release
 * was already public. Default: **commit** `.policy-semver/last-release.json`.
 * If a consumer gitignores it, the file stays local and the release goes on.
 *
 * The commit is not recorded in the file (it cannot contain its own sha):
 * resolve it from `tag`.
 */
export const AUDIT_DIR = ".policy-semver" as const;
export const AUDIT_FILE = "last-release.json" as const;
