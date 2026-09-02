/**
 * Dual-source locks
 *
 * When **both** `VERSION` and `package.json#version` exist:
 * - Require **exact match** before bump (do not pick one silently)
 * - Mismatch → throw / fail CI via `assertDualSourceMatch`
 * - On bump: `writeBothAtomically` (write both or restore both on failure)
 *
 * Extra `*.package.json` entries in `versionFiles` (after the first) lockstep
 * to the same version. They are not a workspace graph (no independent bumps).
 *
 * Implementation: `read-sources.ts`, `write-both.ts`, `assert-match.ts`.
 * `bump/readVersion` + `bump/writeVersion` delegate here when both paths configured.
 * Single-source (only one present) remains in bump.
 */
export const DUAL_SOURCE = {
  requireMatchWhenBothPresent: true,
  atomicWriteBoth: true,
  mismatchFails: true,
} as const;
