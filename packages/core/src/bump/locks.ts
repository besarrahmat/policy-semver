/**
 * Read before implementing `bump/`. Depends on `classify` kind.
 * SemVer **string math** lives here (not in classify).
 *
 * ## Module boundary
 * `bump` applies SemVer + writes version files. Must not call GitHub APIs
 * (comments/releases = `github` module). Must not re-implement classify rules.
 * Safety flags (`allowWrite`, dry-run, sync/fork/skip) are evaluated before write.
 *
 * ## Locks
 * | Rule | Locked behavior |
 * | --- | --- |
 * | Single-bump guarantee | One write path per release; idempotent if already at `nextVersion`; serialize overlapping work |
 * | Sync-from-prod must not bump | PR base = develop **and** head/source = prod (or sync label) → force `none` / no write |
 * | Prod-PR trigger only | Only merge/write when base = `prodBranch`; feature/non-prod base → no write |
 * | Concurrency lock | Workflow `concurrency` group per repo + **prod base** (not PR `github.ref`); **`cancel-in-progress: false`** |
 * | Fork never write | Forks: comment/dry-run OK; `allowWrite: false` always |
 *
 * ## Related locks
 * | Cause | Locked behavior |
 * | --- | --- |
 * | Synchronize / open PR writes VERSION | Dry-run until merged; no file write on synchronize alone |
 * | PR merged + push both fire | Single trigger only (one write job path) |
 * | Sync main→feature bumps | Never write on feature-branch base |
 * | Fork write | Refuse write (`allowWrite: false`) |
 * | Overlapping jobs | concurrency group; do not cancel in progress |
 * | Bot bump loop | Bot commit message **must** include `[skip version]` (or configured trailer) |
 *
 * Also remember:
 * - Dry-run → zero file writes
 * - `envMajor < currentMajor` → fail (prefer bump layer)
 * - Bot message template e.g. `chore(release): vX.Y.Z [skip version]`
 *
 * Concurrency YAML contract (document in Action/README):
 * ```yaml
 * concurrency:
 *   group: policy-semver-${{ github.repository }}-${{ github.event.pull_request.base.ref }}
 *   cancel-in-progress: false
 * ```
 * Key the group on the **base / prod branch**. `github.ref` on `pull_request` is
 * `refs/pull/N/merge`, so two PRs merging to the same base would not serialize.
 */
export const BUMP_SAFETY = {
  singleBump: true,
  syncFromProdNoBump: true,
  prodBaseWriteOnly: true,
  concurrencyCancelInProgress: false,
  forkAllowWrite: false,
  dryRunUntilMerged: true,
  botCommitRequiresSkipTrailer: true,
} as const;

export const BOT_SKIP_TRAILER = "[skip version]" as const;
