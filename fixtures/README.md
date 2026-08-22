# Fixtures

## Config

`fixtures/config/valid|invalid/` — schema / `loadConfig` tests.

## Classifier goldens

`fixtures/classifier/*.json` — each file is one `classify()` case.

`pnpm test:fixtures` (repo root) or `policy-semver test` from a cwd inside this monorepo.

### Add an edge case

1. Copy an existing file in `fixtures/classifier/`.
2. Name it after the edge case (e.g. `edge-case-10-title-feat.json`).
3. Set `input` to the commits / `prTitle` / `envMajor` / `currentVersion` from the edge case.
4. Set `expected.kind`. Include `expected.warnings` when the edge case specifies warnings (exact strings from `@policy-semver/core` `classify`).
5. Run `pnpm test:fixtures` — fail-closed on kind/warning mismatch.
6. Do **not** re-implement classify rules in the CLI; goldens only call core.
