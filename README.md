# PolicySemVer

Policy-first SemVer automation for deployed apps (major via env, `feat & fix:`, develop/`main` topology).

**Start here:** [Quickstart](#quickstart) · [Install channels](#install-channels) · [Migrate](#migrate-from-another-tool) · [Commit cheat sheet](./CONTRIBUTING.md#commit-cheat-sheet)

Public documentation is this README, [CONTRIBUTING.md](./CONTRIBUTING.md), package READMEs, and [examples/](./examples/). A full docs site is not required for v1.

## Status

The GitHub Action is usable: pin a commit SHA in production (see [Quickstart](#quickstart) and [Pin by SHA](#pin-by-sha)), or `@v0.1.0` / `@v0` for demos. The npm CLI is `npx policy-semver@0.1.0`. Major bumps stay manual via `APP_VERSION_MAJOR`. Day-to-day work is on `dev`; `main` is for releases.

## Quickstart

Install the Action, open a PR targeting `main`, and see a dry-run comment — under 15 minutes. Merging is not required.

### 1. Add `versioning.config.json` at the app repo root

```json
{
  "schemaVersion": "1",
  "prodBranch": "main",
  "developBranch": "dev",
  "majorEnv": "APP_VERSION_MAJOR",
  "versionFiles": ["VERSION", "package.json"],
  "changelogPath": "CHANGELOG.md",
  "tagPrefix": "v",
  "skipLabels": ["skip-version"],
  "skipTrailers": ["skip version"],
  "hooks": {
    "beforeBump": null,
    "afterTag": null,
    "afterRelease": null
  }
}
```

Unknown keys are **rejected**.

### 2. Seed a version

Default files are root `VERSION` and root `package.json` `"version"`. If both exist they must match. Consumers may start at `0.0.0`. Nested `packages/*/package.json` are not bumped in v1.

### 3. Add `.github/workflows/policy-semver.yml`

Replace `<full-commit-sha>` with a 40-character commit from [besarrahmat/policy-semver](https://github.com/besarrahmat/policy-semver) that contains `dist/index.js`. Copy it from the commit page, from a clone (`git rev-parse origin/main`), or `git ls-remote https://github.com/besarrahmat/policy-semver.git refs/heads/main` (needs credentials if the repo is private). Do not pin `@main` or `@dev`.

```yaml
name: PolicySemVer

on:
  pull_request:
    branches: [main]
    types: [opened, synchronize, reopened, closed]

concurrency:
  group: policy-semver-${{ github.repository }}-${{ github.event.pull_request.base.ref || github.event.merge_group.base_ref }}
  cancel-in-progress: false

permissions:
  contents: write
  pull-requests: write

jobs:
  version:
    if: github.event.pull_request.base.ref == 'main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0
      - uses: besarrahmat/policy-semver/packages/action@<full-commit-sha>
        env:
          APP_VERSION_MAJOR: ${{ vars.APP_VERSION_MAJOR || '0' }}
        with:
          config-path: versioning.config.json
```

Root metadata is equivalent and is what Marketplace listing uses:

```yaml
- uses: besarrahmat/policy-semver@<full-commit-sha>
```

This repository is **public**. `uses: besarrahmat/policy-semver@v0.1.0` (or a SHA) works from other repos. A **private fork** of this Action still 404s from another private repo — checkout workaround in [`packages/action/README.md`](./packages/action/README.md#consumer-workflow-stub).

### 4. Open a pull request targeting `main`

Use a Conventional subject in the PR title or commits, for example `docs:`, `fix:`, or `feat:`. The workflow file can land in the same PR.

### 5. Read the sticky comment

Expect a **PolicySemVer (dry-run)** comment with `kind` and `next-version`. Open / synchronize / reopened is comment-only. A write (VERSION, tag, Release) happens only after merge to `prodBranch` (or `merge_group`).

Full write stub (build → deploy, merge queue notes, private-repo checkout): [`packages/action/examples/consumer.yml`](./packages/action/examples/consumer.yml).

## Example apps

Copy-out stubs (not workspace packages):

| Path | What it shows |
| --- | --- |
| [`examples/node-app`](./examples/node-app/) | Console + HTTP version from `VERSION` / `package.json` |
| [`examples/cloudflare-worker`](./examples/cloudflare-worker/) | Build-time inject into the Worker bundle (no CDN fetch) |

How a second app pins the Action and `npx policy-semver@0.1.0`: [`examples/README.md`](./examples/README.md#a-second-consumer-app).

## Install channels

This repo produces three artifacts. They are not interchangeable.

| Artifact | How to use | Runtime deps on the consumer |
| --- | --- | --- |
| GitHub Action | `uses: besarrahmat/policy-semver@<sha>` (prod) or `@v0.1.0` / `@v0` (demo) | **None** — runners execute committed `dist/index.js` |
| `policy-semver` CLI | `npx policy-semver@0.1.0 …` | Resolved from npm; depends on `@policy-semver/core` |
| `@policy-semver/core` | `pnpm add @policy-semver/core@0.1.0` | Resolved from npm |

Contributors still run the workspace CLI: `pnpm policy-semver --help`.

```bash
npx policy-semver@0.1.0 classify --help
```

```yaml
# Action — production: full SHA. Demo: @v0.1.0 or @v0.
- uses: besarrahmat/policy-semver/packages/action@<full-commit-sha>
# - uses: besarrahmat/policy-semver@v0.1.0
```

Do not `npm install` / `npx` the Action. Do not treat the CLI as a substitute for the write path (tag + GitHub Release).

## Public npm

Published: **`policy-semver@0.1.0`** and **`@policy-semver/core@0.1.0`**. Install the CLI with `npx policy-semver@0.1.0`. The Action stays git `uses:` (not npm), for example `@v0.1.0` or a full commit SHA.

| Package | Access |
| --- | --- |
| `policy-semver` | public (CLI) |
| `@policy-semver/core` | public (library) |
| `@policy-semver/action` / monorepo root | **not** published |

Publish uses [Trusted publishing](https://docs.npmjs.com/trusted-publishers/) (OIDC) from GitHub Actions: permission `id-token: write`, npm CLI **≥ 11.5.1**, Node **24+** (`.node-version`), GitHub-hosted runner, workflow filename **`publish.yml`** (exact, including `.yml`). [Provenance](https://docs.npmjs.com/generating-provenance-statements) is generated automatically under trusted publishing **only from a public GitHub repo** — private source repos cannot publish provenance attestations. `0.1.0` was a laptop publish (no OIDC attestation); later versions should publish from `publish.yml`.

`package.json` `repository.url` must be `git+https://github.com/besarrahmat/policy-semver.git`. Publishable packages use `"files"` (`dist`, `LICENSE`, `README.md`) and `publishConfig.access: public`.

**Published versions are immutable.** A fix is `0.1.1`, not an overwrite of `0.1.0`.

## Pin by SHA

Production workflows pin a **full commit SHA**. Moving major tags (`v0` / `v1`) and the release tag `@v0.1.0` are acceptable for demos. Floating `@main` / `@dev` is not.

```yaml
- uses: besarrahmat/policy-semver/packages/action@<full-commit-sha>
# - uses: besarrahmat/policy-semver@v0.1.0
```

## Policy differences

These are the rules that surprise people coming from other release bots. Classifier details: [CONTRIBUTING.md](./CONTRIBUTING.md#commit-cheat-sheet). Golden cases live in [`fixtures/classifier/`](./fixtures/classifier/).

| Topic | PolicySemVer |
| --- | --- |
| Major | Only when the env named by `majorEnv` (default **`APP_VERSION_MAJOR`**) is raised to a new integer (`N` → `N.0.0`). `BREAKING CHANGE` / `feat!:` warn; they never auto-major. |
| `feat & fix:` | First-class **minor** (same bucket as `feat:`). Optional spaces around `&`. |
| Sync prod → develop | `kind: none` — no bump, no tag (for example `main` → `dev`). |
| 0.x | `APP_VERSION_MAJOR=0` until a human raises it. Feat stays minor, fix stays patch. |
| Docs-only | `docs:` / `docs(scope):` → `kind: none`. |
| Fork PR | Sticky comment only — never write. |

## Permissions and forks

```yaml
permissions:
  contents: write      # commit, tag, GitHub Release (write path)
  pull-requests: write # sticky dry-run comment
```

Fork PRs: comment OK, `allowWrite: false`. Sync `develop ← prod`: no write. `push` to production is skipped (avoids a double bump). If branch protection blocks `github-actions[bot]`, use a PAT / GitHub App (`POLICY_SEMVER_TOKEN`) with ruleset bypass.

Details: [`packages/action/README.md`](./packages/action/README.md) — [Permissions](./packages/action/README.md#permissions-least-privilege), [Fork / prod / sync](./packages/action/README.md#fork--prod--sync-runtime), [Token when `GITHUB_TOKEN` cannot push](./packages/action/README.md#token-when-github_token-cannot-push).

## What this is not

- **Not** a Changesets replacement for interdependent npm monorepos. v1 versions the **repo root** only. This project does not claim to be better than Changesets for monorepos.
- **Not** auto-major from Conventional Commits.
- **Not** an npm-publish pipeline for consumer apps (optional hook only).
- **Not** a GitLab / Bitbucket adapter.
- **Not** two names for one install: Action = git `uses:`; CLI = npm.

## Migrate from another tool

Short pages (what to remove, what will surprise you, when to stay):

- [From semantic-release](./examples/migrate-from-semantic-release.md)
- [From release-please](./examples/migrate-from-release-please.md)
- [From Changesets](./examples/migrate-from-changesets.md) (no monorepo graph parity)
- [From release-it](./examples/migrate-from-release-it.md)

Index and comparison table: [`examples/README.md`](./examples/README.md).

## Configuration

Policy lives in **`versioning.config.json`** at the repo root (JSON Schema fail-closed).

| Item | Default / notes |
| --- | --- |
| Config path | `versioning.config.json` |
| Major bumps | Manual only via env named by `majorEnv` (default **`APP_VERSION_MAJOR`**) — set to the next major integer (e.g. `2`) to reset to `N.0.0`; never auto-major from `BREAKING` / `feat!:` |
| 0.x | `APP_VERSION_MAJOR=0` until a human raises it. Feat stays minor, fix stays patch, major only via env — 0.x is **not** "any breaking change may be a minor". First public tool release: **0.1.0** (not `0.0.0`). Consumers may seed `VERSION` `0.0.0`. |
| Dependabot | Subject `Bump …` / `chore(deps):` → **patch**, not minor. Label `skip-version` disables the bump. |
| Branches | `prodBranch` = `main`, `developBranch` = `dev` (this repo's dogfood topology) |
| Dual-source | Default `versionFiles`: **root** `VERSION` + **root** `package.json`. Nested `packages/*/package.json` are not bumped separately in v1 |
| `tagPrefix` | Default `v` → tag `vX.Y.Z`. A human tag with a missing or wrong prefix is **not** renamed; `verify` checks `{tagPrefix}{VERSION}` |
| `release/*` | Not production unless `prodBranch` is set to that name; PRs targeting `release/1.2` are ignored |
| Workspaces | v1 is **root-only**. Omit the `workspaces` key or set it to `null`. Path filters are later work; a missed workspace path is not a v1 bug |
| Audit | `.policy-semver/last-release.json` after a successful release — **commit** by default |

Unknown keys in the config file are **rejected**. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## CI concurrency (bump writes)

Workflows that **write** versions / tags must use:

```yaml
concurrency:
  group: policy-semver-${{ github.repository }}-${{ github.event.pull_request.base.ref || github.event.merge_group.base_ref }}
  cancel-in-progress: false
```

Do not put the write job in the same cancel-friendly concurrency group as flaky lint. Details: [`packages/action/README.md`](./packages/action/README.md).

## Branch protection

The Action does not bump on `push` to production. Protect **`main`** (consumer `prodBranch`) so VERSION / tags only change through a PR.

| Repo | Protect | Why |
| --- | --- | --- |
| **Consumer** (app using the Action) | `main` / `prodBranch` | Require a pull request; block force-pushes. After merge the Action must push the bump commit — if `github-actions[bot]` is blocked (PAT / GitHub App). Settings: [`packages/action/README.md`](./packages/action/README.md) |
| **This tool repo** | `main` | Same rules. Day-to-day work stays on `dev`; only `dev` → `main` PRs land on production. See [CONTRIBUTING.md](./CONTRIBUTING.md) |

The Action **skips `push` events**, so a direct push does not bump. Branch protection is still required so humans cannot rewrite VERSION by pushing to `main`.

## Dogfood (this repo)

This repository versions itself with `.github/workflows/policy-semver.yml` (`uses: ./packages/action`) on pull requests targeting `main`.

Major stays manual: repository variable `APP_VERSION_MAJOR` (keep `0` until a human raises it). If branch protection blocks `github-actions[bot]`, set secret `POLICY_SEMVER_TOKEN` (PAT or GitHub App with `contents: write` and ruleset bypass) so the bump commit can push to `main`. Details: [`packages/action/README.md`](./packages/action/README.md) (Token when `GITHUB_TOKEN` cannot push) and [CONTRIBUTING.md](./CONTRIBUTING.md).

Manual edits to `VERSION` / root `package.json` `version` are sunset as of 2026-08-22. After the dogfood workflow is live, do not bump those files by hand. Nested `packages/*/package.json` stay `0.0.0` until later (`0.1.0` lockstep). There is no Changesets process in this repo.

## Community

- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## License

[MIT](./LICENSE) © 2026 Besar Rahmat
