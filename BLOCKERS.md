# Blockers

Accepted findings that we are not fixing in the current release. Add a row when something is blocked; resolve or accept with rationale. Do not put secrets here.

| Date       | Area       | Issue                                                                                                        | Owner | Status   | Resolution                                                                |
|------------|------------|--------------------------------------------------------------------------------------------------------------|-------|----------|---------------------------------------------------------------------------|
| 2026-09-01 | Dev bundle | esbuild low [GHSA-g7r4-m6w7-qqqr](https://github.com/advisories/GHSA-g7r4-m6w7-qqqr) (Windows esbuild serve) | —     | accepted | Dev-only via tsup/vitest; revisit when those tools use `esbuild >=0.28.1` |

## esbuild — low — GHSA-g7r4-m6w7-qqqr

- **Package:** `esbuild` `>=0.27.3 <0.28.1` (via `tsup` / `vitest`)
- **Patched:** `>=0.28.1`
- **Why accepted:** Dev-only (bundle CLI/Action at build time). The advisory is the esbuild **development server** on Windows allowing arbitrary file read. This repo does not run `esbuild --serve` / Vite as a public server.
- **Revisit:** when `tsup` / `vitest` depend on `esbuild >=0.28.1`. Do not override `esbuild` until those tools declare compatibility.
