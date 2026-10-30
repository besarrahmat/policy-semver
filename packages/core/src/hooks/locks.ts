/**
 * Shell hooks. Command strings only (no JS callbacks) in v1.
 *
 * ## When they run
 * | Hook | After | Before |
 * | --- | --- | --- |
 * | `beforeBump` | classify + applyBump | any file write / tag |
 * | `afterTag` | local `git tag -a` | push + GitHub Release |
 * | `afterRelease` | `repos.createRelease` | end of the run |
 *
 * `null` / omitted → skip. `kind === "none"` or dry-run → do not run hooks.
 * Runtime: `sh -c <command>` with inherited `process.env` minus the Action's
 * token, plus POLICY_SEMVER_*. Killed after a fixed timeout.
 *
 * ## Transactional expectation
 * | Failure | VERSION / changelog | Annotated tag | GitHub Release |
 * | --- | --- | --- | --- |
 * | `beforeBump` non-zero | **never written** | none | none |
 * | `afterTag` non-zero | already written + committed | **local tag exists**; not pushed | none |
 * | `afterRelease` non-zero | done | pushed | **already created** |
 *
 * We do **not** roll back a local tag or a GitHub Release. Prefer never-write
 * (`beforeBump`) over restore. Rerunning a failed job re-runs `afterRelease`
 * (at-least-once), so that hook must be idempotent. `beforeBump` and `afterTag`
 * may also run again if the job failed before its push landed. Dual-source restore inside `writeBothAtomically`
 * is unrelated — that only covers a mid-write exception after hooks succeeded.
 */
export const HOOK_NAMES = ["beforeBump", "afterTag", "afterRelease"] as const;

export const HOOK_ENV = {
  version: "POLICY_SEMVER_VERSION",
  kind: "POLICY_SEMVER_KIND",
  dryRun: "POLICY_SEMVER_DRY_RUN",
} as const;

export const HOOK_SHELL = "sh" as const;
