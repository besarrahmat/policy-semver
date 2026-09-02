# Blockers

Accepted findings that we are not fixing in the current release. Add a row when something is blocked; resolve or accept with rationale. Do not put secrets here.

| Date       | Area       | Issue                                                                                                        | Owner | Status   | Resolution                                                                                          |
|------------|------------|--------------------------------------------------------------------------------------------------------------|-------|----------|-----------------------------------------------------------------------------------------------------|
| 2026-09-01 | Dev bundle | esbuild low [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) (Windows esbuild serve) | —     | resolved | pnpm override `esbuild: ^0.28.1` (2026-09-02). `tsup@8.5.1` still declares `^0.27`; drop override when it does not. |

## esbuild — low — GHSA-g7r4-m6w7-qqqr

- **Package:** `esbuild` `>=0.27.3 <0.28.1` (was nested under `tsup@8.5.1`)
- **Patched:** `>=0.28.1`
- **Resolution:** `pnpm-workspace.yaml` override `esbuild: "^0.28.1"`. Advisory is the Windows `esbuild --serve` path-traversal; this repo only uses esbuild via tsup/vitest at build time.
- **Drop override:** when `tsup` declares `esbuild ^0.28` (or newer) on its own.
