/**
 * Phase 6.A — Action docs locks (PS-08 / VF-10,11 · VE-35,43)
 *
 * Official refs (read before changing locks):
 * - https://docs.github.com/en/actions/creating-actions/creating-a-javascript-action
 * - https://github.com/actions/toolkit/blob/main/docs/action-versioning.md
 * - https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
 *
 * Implement runtime in 6.B; ncc bundle + commit in 6.C — this file locks decisions only.
 *
 * ## JavaScript Action (GitHub docs)
 * | Concern | Lock |
 * | --- | --- |
 * | Metadata | `action.yml` at **repo root** (layout A) |
 * | Runtime | `runs.using: node24` — **never** regress to `node20` |
 * | Entry | `runs.main: dist/index.js` (repo-root `dist/`) |
 * | Deps on runner | Runners do **not** `npm install` Action deps → **commit** bundled `dist/` |
 *
 * ## Bundler
 * | Preference | Lock |
 * | --- | --- |
 * | First try | **`@vercel/ncc`** (plan preference) |
 * | Fallback | rollup (see actions/typescript-action) or esbuild if Node 24/ESM breaks ncc |
 * | Document | Choice lives in `packages/action/README.md` (and BLOCKERS if blocked) |
 * | Output | Exactly one entry: repo-root `dist/index.js` (+ licenses when using ncc) |
 *
 * ## Consumer versioning (toolkit action-versioning)
 * | Practice | Lock |
 * | --- | --- |
 * | Prefer | Pin commit **SHA** for reproducibility |
 * | Also OK | Moving major tag (`v0`, `v1`) after release tags exist |
 * | Not | Floating `@main` / `@dev` in production consumer workflows |
 *
 * ## Marketplace / layout (Phase 12 in scope → lock A **now**)
 * | Layout | Meaning |
 * | --- | --- |
 * | **A (locked)** | Root `action.yml` + committed root `dist/` — required for Marketplace listing |
 * | B (rejected for ship) | `uses: org/repo/packages/action@ref` only — dogfood OK, **no** Marketplace auto-list |
 *
 * Sources stay under `packages/action/`; build emits to **repo-root** `dist/`.
 * Package-local `packages/action/action.yml` may mirror for path-based dogfood
 * (`main: ../../dist/index.js`) — canonical metadata for consumers/Marketplace is **root**.
 */
export const ACTION_LAYOUT = {
  id: "A",
  marketplaceRequired: true,
  actionYmlPath: "action.yml",
  distEntry: "dist/index.js",
  sourcePackage: "packages/action",
} as const;

export const ACTION_RUNTIME = {
  runsUsing: "node24",
  /** Do not change without an explicit platform decision + checklist update */
  forbidNode20: true,
  main: "dist/index.js",
} as const;

export const ACTION_BUNDLE = {
  commitDist: true,
  reason:
    "GitHub checks out the action ref and runs main; it does not install Action package.json deps",
  bundlerPreference: "ncc",
  bundlerPackage: "@vercel/ncc",
  bundlerFallbacks: ["rollup", "esbuild"] as const,
  /** Track if ncc fails on Node 24/ESM: https://github.com/vercel/ncc/issues/1297 */
  nccIssueTracker: "https://github.com/vercel/ncc/issues/1297",
} as const;

export const ACTION_VERSIONING = {
  preferPinSha: true,
  allowMovingMajorTag: true,
  discourageFloatingBranchRef: true,
} as const;

export const ACTION_ADAPTER = { thinOnly: true } as const;

/** Write trigger: merged PR only — not `push` to prod (hindari VE-13 double bump). */
export const ACTION_EVENT = {
  writeOn: "pull_request_closed_merged",
  mergeGroupIsWrite: true,
  dryRunActions: ["opened", "synchronize", "reopened"] as const,
  /** Sync check BEFORE prod-base (VF-03); mermaid nests Sync under prod — unreachable for real sync PRs */
  syncBeforeProdBaseCheck: true,
} as const;

export const ACTION_COMMENT = {
  marker: "<!-- policy-semver -->",
  upsertOneOnly: true,
} as const;
