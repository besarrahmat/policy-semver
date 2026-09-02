/**
 * Security harden (Action permissions, fork write-refuse, redact, Dependabot).
 *
 * Re-verified: 2026-09-01.
 *
 * ## Audit
 * `pnpm audit` (2026-09-01): `@actions/github` bumped to **9.1.1** (undici 6.x);
 * `nanoid@^3` overridden to **3.3.18** in `pnpm-workspace.yaml`.
 * `esbuild` overridden to **^0.28.1** (GHSA-g7r4-m6w7-qqqr; `tsup@8.5.1`
 * still declares `^0.27`). See root `BLOCKERS.md`.
 *
 * ## Action / CI permissions
 * Consumer + dogfood write workflows: `contents: write` + `pull-requests: write`
 * only. CI and dependency-review: `contents: read`. Publish: `contents: read` +
 * `id-token: write` (OIDC). No `issues: write` / `id-token` on the Action job.
 *
 * ## Fork
 * `decideActionMode({ isFork: true })` → `allowWrite: false` even when merged.
 *
 * ## Release bodies
 * `createGitHubRelease` and `writeChangelog` run `redactSecrets` before send/disk.
 *
 * ## Consumers
 * `examples/*` use published `npx policy-semver@1.0.0` and git `uses:` SHA pins
 * — not `file:` / workspace Action installs. Production pin-by-SHA stays
 * recommended. Dependabot + dependency-review-action@v5 on this repo.
 */
export const HARDEN_AUDIT = {
  date: "2026-09-01",
  actionsGithubMin: "9.1.1",
  nanoidOverride: "3.3.18",
  esbuildOverride: "^0.28.1",
  blockersFile: "BLOCKERS.md",
} as const;

export const HARDEN_PERMISSIONS = {
  consumer: ["contents: write", "pull-requests: write"] as const,
  ci: ["contents: read"] as const,
  dependencyReview: ["contents: read"] as const,
  publish: ["contents: read", "id-token: write"] as const,
} as const;

export const HARDEN_RUNTIME = {
  forkRefuseWrite: true,
  redactReleaseBodies: true,
  pinShaRecommended: true,
  examplesPublishedChannels: true,
} as const;

/** Standing security controls — keep true on every PR to `dev`. */
export const SECURITY_CHECKLIST = {
  leastPrivilegeAction: true,
  forkCommentOnly: true,
  redactLogsAndReleaseBodies: true,
  documentPolicySemverToken: true,
  oidcPublishPreferred: true,
  neverCommitEnvOrTokens: true,
} as const;
