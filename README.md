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
| Branches | `prodBranch` = `main`, `developBranch` = `dev` (this repo’s dogfood topology) |
| Audit | `.policy-semver/last-release.json` after a successful release — **commit** by default |

Unknown keys in the config file are **rejected**. See [CONTRIBUTING.md](./CONTRIBUTING.md).

## CI concurrency (bump writes)

Workflows that **write** versions / tags must use:

```yaml
concurrency:
  group: policy-semver-${{ github.repository }}-${{ github.event.pull_request.base.ref }}
  cancel-in-progress: false
```

Do not put the write job in the same cancel-friendly concurrency group as flaky lint. Details: [`packages/action/README.md`](./packages/action/README.md).

## Branch protection (VE-15, VE-42)

The Action does not bump on `push` to production. Protect **`main`** (consumer `prodBranch`) so VERSION / tags only change through a PR.

| Repo | Protect | Why |
| --- | --- | --- |
| **Consumer** (app using the Action) | `main` / `prodBranch` | VE-15: require a pull request; block force-pushes. After merge the Action must push the bump commit — if `github-actions[bot]` is blocked, that is VE-42 (PAT / GitHub App). Settings: [`packages/action/README.md`](./packages/action/README.md) |
| **This tool repo** | `main` | Same rules. Day-to-day work stays on `dev`; only `dev` → `main` PRs land on production. See [CONTRIBUTING.md](./CONTRIBUTING.md) |

The Action **skips `push` events**, so a direct push does not bump. Branch protection is still required so humans cannot rewrite VERSION by pushing to `main`.

## Community

- [Contributing](./CONTRIBUTING.md)
- [Security policy](./SECURITY.md)
- [Code of conduct](./CODE_OF_CONDUCT.md)

## License

[MIT](./LICENSE) © 2026 Besar Rahmat
