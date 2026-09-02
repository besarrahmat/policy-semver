/**
 * Workspaces policy (v1)
 *
 * ## Context
 * v1 versions files listed in `versionFiles` **to the same version**.
 * Default is repo root (`VERSION` + root `package.json`). Extra nested
 * package.json paths lockstep with root — they are not independent package
 * bumps. Consumers coming from Changesets expect a workspace graph or at
 * least path filters. Schema additionalProperties false means any new
 * config key is a coordinated schema change.
 *
 * ## Options
 * - **A — Path-filter MVP:** `workspaces.paths` + `mode: skip-if-no-match`.
 *   Classify/bump only when changed files intersect globs. A missed path
 *   silently skips the bump.
 * - **B — Deferred to 0.2:** no workspace graph and no path-filter in v1.
 *   Omit the `workspaces` key from the schema so it fail-closed as unknown.
 *
 * ## Decision
 * **Option B**, 2026-09-01. No workspace graph in v1. Prefer omit the key
 * entirely — do not accept `workspaces: null` as a placeholder.
 *
 * ## Why
 * Path-filter MVP still is not Changesets-class interdependent package
 * graph parity, and a missed path would look like "the tool missed a bump."
 * Defer the whole surface to 0.2 rather than ship a leaky filter.
 * We accept that independent per-package versions need Changesets (or 0.2).
 * Same-version lockstep is `versionFiles` entries, not a `workspaces` key.
 *
 * ## Consequences
 * Easy: unknown `workspaces` fails closed; lockstep extras use `versionFiles`.
 * Hard: no independent per-package bump; adding Option A later requires a
 * schema migration (`schemaVersion` or a new key) — not a silent default.
 */
export const WORKSPACES_V1 = {
  option: "B",
  deferredTo: "0.2",
  schemaKeyOmitted: true,
  acceptNullPlaceholder: false,
  pathFilterMvp: false,
  packageGraphParity: false,
  pathFilterFalseNegativesNotAv1Bug: true,
} as const;
