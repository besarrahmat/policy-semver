# Contributing

## Branch workflow

- Do day-to-day work on **`dev`**.
- Open a PR **`dev` → `main`** only when preparing a publishable release.
- Do not land feature work directly on `main`.

## Tooling

- Node **24+** (see `.node-version`).
- pnpm via root `"packageManager": "pnpm@11.20.0"`.
- Prefer Corepack when available: `corepack enable` then `corepack prepare`.
- On Homebrew Node without Corepack: install pnpm globally and match that version.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) subject lines, for example:

- `feat:` / `feat(scope):` / `feat & fix:` — minor (once the classifier ships)
- `fix:` / `chore:` / `refactor:` — patch
- `docs:` — docs-only
- `chore:` — tooling / Phase 0 bootstrap

## Before you push

```bash
pnpm test
pnpm test:fixtures
pnpm typecheck
pnpm lint
```

## Config

`versioning.config.json` is fail-closed: **unknown keys fail validation** (and will fail CI once config checks are wired). Extend `schemas/versioning.config.schema.json` (then sync the package embed) before adding new keys. Never “warn and continue” on unknown policy fields.

## Schema embed

Canonical schema: `schemas/versioning.config.schema.json`.  
Embed used by core: `packages/core/src/config/versioning.config.schema.json`.

```bash
pnpm sync:schema
diff schemas/versioning.config.schema.json packages/core/src/config/versioning.config.schema.json
```

Expect empty `diff` (exit 0).

**Pick (locked):** wire **both** `prebuild` hooks — do not rely on CI-only sync:

| Hook | Where | When it runs |
| --- | --- | --- |
| `"prebuild": "pnpm sync:schema"` | root `package.json` | Before root `pnpm build` |
| `"prebuild": "pnpm -w run sync:schema"` | `packages/cli` | Before `pnpm --filter ./packages/cli build` |

Root script `"sync:schema"` copies canonical → embed. Always run sync (or a build that triggers `prebuild`) after editing the schema.

## Secrets

Never commit `.env`, npm tokens, PATs, or `_authToken` lines in `.npmrc`. Prefer `~/.npmrc` or CI secrets / Trusted Publishing.

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
