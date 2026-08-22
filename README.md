# PolicySemVer

Policy-first SemVer automation for deployed apps (major via env, `feat & fix:`, develop/`main` topology).

## Status

Spec/docs first. Implementation follows Phases 0–12 on branch `dev`; `main` for releases.

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
| Workspaces | v1 is **root-only**. Omit the `workspaces` key or set it to `null`. Path filters are Phase 12; a missed workspace path is not a v1 bug |
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

Manual edits to `VERSION` / root `package.json` `version` are sunset as of 2026-08-22. After the dogfood workflow is live, do not bump those files by hand. Nested `packages/*/package.json` stay `0.0.0` until later phase (`0.1.0` lockstep). There is no Changesets process in this repo.

## Community

- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## License

[MIT](./LICENSE) © 2026 Besar Rahmat
