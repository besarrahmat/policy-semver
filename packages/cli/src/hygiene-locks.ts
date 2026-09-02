/**
 * Repo hygiene — keep true on every PR to `dev`.
 *
 * Tracked blockers: root `BLOCKERS.md`. Do not link the gitignored plan folder.
 */
export const REPO_HYGIENE = {
  conventionalCommitsOnDev: true,
  commitActionDist: true,
  schemaVersionBumpDocumented: true,
  secondConsumerOnPublishedArtifacts: true,
  reverifyTrustedPublishAndNode24: true,
  blockersFile: "BLOCKERS.md",
} as const;

export const SCHEMA_VERSION_CURRENT = "1" as const;
