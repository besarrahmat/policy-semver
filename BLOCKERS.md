# Blockers

Accepted findings that we are not fixing in the current release. Add a row when something is blocked; resolve or accept with rationale. Do not put secrets here.

| Date       | Area       | Issue                                                                                                        | Owner | Status   | Resolution                                                                                                      |
| ---------- | ---------- | ------------------------------------------------------------------------------------------------------------ | ----- | -------- | --------------------------------------------------------------------------------------------------------------- |
| 2026-09-01 | Dev bundle | esbuild low [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) (Windows esbuild serve) | —     | resolved | pnpm override `esbuild: ^0.28.1` (2026-09-02); dropped 2026-10-30 once `tsup@9.0.0` declared `esbuild ^0.28.2`. |
| 2026-11-02 | Reconcile  | A commit forged with the bot's author name and a `Policy-Semver-PR` trailer can suppress that PR's release.  | —     | accepted | The author already has write access, which offers easier ways to do damage.                                     |
| 2026-11-02 | Reconcile  | Changing `tagPrefix` after a failed release makes its rerun report the tag as missing.                       | —     | accepted | It fails closed with a clear message, and the change is rare.                                                   |
| 2026-11-02 | Git        | `readVersionAtRef` treats any `git show` failure as a missing file.                                          | —     | accepted | Write paths sync first, so the fallback reads the same tree; only a dry-run preview can be off.                 |
| 2026-11-02 | Hooks      | `afterTag` runs before the push, so anything it publishes outlives a rejected push.                          | —     | accepted | Documented in the README: publish from `afterRelease`.                                                          |
| 2026-11-02 | Action     | The sticky comment searches 100 comments; GitHub lists a PR's first 250 commits.                             | —     | accepted | A duplicate comment is cosmetic, and the commit cap already warns.                                              |

## esbuild — low — GHSA-g7r4-m6w7-qqqr

- **Package:** `esbuild` `>=0.27.3 <0.28.1` (was nested under `tsup@8.5.1`)
- **Patched:** `>=0.28.1`
- **Resolution:** `pnpm-workspace.yaml` override `esbuild: "^0.28.1"` (2026-09-02). Advisory is the Windows `esbuild --serve` path-traversal; this repo only uses esbuild via tsup/vitest at build time.
- **Override dropped:** 2026-10-30 — `tsup@9.0.0` declares `esbuild ^0.28.2` on its own. `harden-locks.test.ts` still fails if the lockfile resolves any `esbuild` below `0.28.1`.
