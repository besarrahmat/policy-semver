# Contributing

## Branch workflow

- Do day-to-day work on **`dev`**.
- Open a PR **`dev` → `main`** only when preparing a publishable release.
- Do not land feature work directly on `main`.

## Branch protection (this tool repo)

Protect **`main`** so it is not a direct-push branch.

1. GitHub → **Settings → Rules → Rulesets → New branch ruleset** (or classic **Settings → Branches → Add branch protection rule**).
2. Target `main`. Enforcement: **Active**.
3. Enable **Require a pull request before merging**, **Block force pushes**, and **Restrict deletions**.
4. Do not add a blanket bypass for all admins if that restores direct pushes to `main`.

The Action must push the bump commit onto protected `main`. `GITHUB_TOKEN` (`github-actions[bot]`) is often blocked. Add a dedicated GitHub App (or PAT user) to the ruleset **Bypass list**, store it as `POLICY_SEMVER_TOKEN`, and pass it as the Action `token` input. Consumer-side detail lives in `packages/action/README.md`.

`dev` may stay less strict for day-to-day work. Sync `main` → `dev` must not bump.

## Tooling

- Node **24+** (see `.node-version`).
- pnpm via root `"packageManager": "pnpm@11.20.0"`.
- Prefer Corepack when available: `corepack enable` then `corepack prepare`.
- On Homebrew Node without Corepack: install pnpm globally and match that version.

## Commit cheat sheet

| Subject | Bump |
| --- | --- |
| `feat:` / `feat(scope):` / `feat & fix:` | minor |
| `fix:` / `chore:` / `refactor:` | patch |
| `docs:` only | none |
| major env raised | `N.0.0` |
| `[skip version]` / label | none |

Major is **never** inferred from `BREAKING CHANGE` / `feat!:` — those warn only. Raise the env named by `majorEnv` (default `APP_VERSION_MAJOR`). Sync `main` → `dev` must not bump.

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/) subject lines, for example:

- `feat:` / `feat(scope):` / `feat & fix:` — minor
- `fix:` / `chore:` / `refactor:` — patch
- `feature:` (typo, not `feat:`) — patch, not minor
- Dependabot `Bump …` / `chore(deps):` — patch; label `skip-version` disables the bump
- `docs:` — docs-only
- `chore:` — tooling / bootstrap
- 0.x: `APP_VERSION_MAJOR=0` until a human raises it; feat is still minor, fix still patch, major only via env
- Revert of a bump does **not** roll VERSION back
- Tags must be `{tagPrefix}{version}` (default `v1.2.3`). A human `1.2.3` / `release-1.2.3` is not rewritten; `pnpm policy-semver verify` will fail once tags exist
- v1 versions the **repo root** only. Do not expect `packages/foo/package.json` to bump on its own

## Before you push

```bash
pnpm test
pnpm test:fixtures
pnpm typecheck
pnpm lint
```

CI (`.github/workflows/ci.yml`) runs the same unit + golden layers on every PR to `dev` (and `main`).

## Testing

Keep these layers green on every PR to `dev`. Do not delete files under `fixtures/classifier/` to make CI pass — add a case or fix `classify`.

| Layer | What | Proof |
| --- | --- | --- |
| Unit | classify, SemVer math, config validate, redact | `pnpm test` |
| Golden | `fixtures/classifier/*.json` | `pnpm test:fixtures` |
| Integration | bump + changelog in a temp dir | `pnpm test` |
| Action | decision matrix + consumer stub | `pnpm test` |
| Dogfood | this repo on PRs to `main` | `.github/workflows/policy-semver.yml` |

## Config

`versioning.config.json` is fail-closed: **unknown keys fail validation**. v1 **omits** `workspaces` (no path-filter, no package graph) — that key fails closed until a 0.2 schema update. Breaking config changes bump `schemaVersion` (currently `"1"`) and document the migration here and in the README Configuration table. Extend `schemas/versioning.config.schema.json` (then sync the package embed) before adding new keys. Never "warn and continue" on unknown policy fields.

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

## Security

Standing controls. Keep them true on every PR to `dev`.

| Control | Lock |
| --- | --- |
| Least privilege | Write workflows: `contents: write` + `pull-requests: write` only. CI: `contents: read`. npm publish: `contents: read` + `id-token: write`. |
| Fork PRs | Sticky comment OK; never write (`allowWrite: false`). |
| Secrets in Release / changelog | `redactSecrets` before disk and GitHub Release. Do not log tokens. |
| Protected `main` | Secret `POLICY_SEMVER_TOKEN` (PAT or GitHub App) with ruleset bypass. Details: [`packages/action/README.md`](./packages/action/README.md#token-when-github_token-cannot-push). |
| npm publish | OIDC trusted publishing from [`.github/workflows/publish.yml`](./.github/workflows/publish.yml). No long-lived `NPM_TOKEN` in that workflow. |
| Do not commit | `.env`, npm tokens, PATs, or `_authToken` lines in `.npmrc`. Prefer `~/.npmrc` or CI secrets / Trusted Publishing. |

Never commit `.env`, npm tokens, PATs, or `_authToken` lines in `.npmrc`.

## Repo hygiene

Keep these true on every PR to `dev`.

| Item | What to do |
| --- | --- |
| Conventional Commits | Subjects on `dev` must be prefixes the dogfood classifier understands (`feat:`, `fix:`, `docs:`, `feat & fix:`, …). See [Commit cheat sheet](#commit-cheat-sheet). |
| Action `dist/` | After changing Action sources, rebuild and **commit** repo-root `dist/`: `pnpm --filter @policy-semver/action run build`. CI fails on `git diff --exit-code dist/`. |
| Config schema | Breaking `versioning.config.json` changes bump `schemaVersion` (currently `"1"`) and document the migration. Then `pnpm sync:schema`. |
| Second consumer | After a public npm/Action release, keep [`examples/`](./examples/) on the **published** channel (`npx policy-semver@0.1.0`, Action SHA pin) — not `file:` / workspace installs. |
| Before a publishable release | Re-read [npm Trusted publishing](https://docs.npmjs.com/trusted-publishers/) and confirm Action `runs.using: node24` (never `node20`) plus `.node-version` **24**. |
| Blockers | Log accepted or open findings in [`BLOCKERS.md`](./BLOCKERS.md) (table + rationale). Do not commit secrets. |

```markdown
| Date | Area | Issue | Owner | Status | Resolution |
|------|------|-------|-------|--------|------------|
| YYYY-MM-DD | … | … | … | open / accepted | … |
```

## Launch

Public v1 surface. Keep these true before calling a publishable release done. Quickstart must stay **under 15 minutes**.

| Check | Lock |
| --- | --- |
| npm CLI | `npx policy-semver@0.1.0` (published artifact, not a workspace path) |
| Action | GitHub Marketplace listing plus `besarrahmat/policy-semver@<full-commit-sha>` |
| Community | Root [`LICENSE`](./LICENSE), [`SECURITY.md`](./SECURITY.md), [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md) |
| Consumers | Depend on published npm / Action SHA — do not vendor `packages/` |
| Positioning | Announce differentiators; do not claim to replace Changesets' package graph |

## Code of Conduct

See [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).
