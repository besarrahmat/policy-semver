# Examples

Runnable consumer stubs and migration notes. Copy-paste Action install: root [README quickstart](../README.md#quickstart).

These apps are **not** pnpm workspace members (`pnpm-workspace.yaml` is `packages/*` only). Copy a folder into its own GitHub repo. Do not import `@policy-semver/core` or vendor `packages/` into the app.

v1 docs are README + these pages. There is no separate docs site.

## Example apps

| Path | What it shows |
| --- | --- |
| [node-app](./node-app/) | Dual-source version files, sample workflow, console + HTTP version (consumer displays version) |
| [cloudflare-worker](./cloudflare-worker/) | Wrangler stub; **build-time** inject of `VERSION` into the Worker bundle (do not read version from a CDN) |

Production write workflow (build → deploy, merge queue, private-fork checkout commented): [`packages/action/examples/consumer.yml`](../packages/action/examples/consumer.yml).

## A second consumer app

A second deployed app (not this monorepo) wires the **published** artifacts like this:

1. Copy [`node-app`](./node-app/) or [`cloudflare-worker`](./cloudflare-worker/) to a new repository.
2. Pin the Action by SHA in `.github/workflows/policy-semver.yml` (prod):
   `uses: besarrahmat/policy-semver@<full-commit-sha>`
   (path-based equivalent: `uses: besarrahmat/policy-semver/packages/action@<sha>`; demo `@v0.1.0`).
   [GitHub Marketplace](https://github.com/marketplace/actions/policysemver) is discoverability only — production still pins a SHA.
3. Set repository variable `APP_VERSION_MAJOR=0`.
4. From that app root: `npx policy-semver@0.1.0 classify` / `verify`.
5. Do not copy `packages/core` / `packages/cli` into the app.

This Action repo is public, so `uses: besarrahmat/policy-semver@v0.1.0` works from other repos. A private fork still 404s — checkout workaround in [`packages/action/README.md`](../packages/action/README.md#consumer-workflow-stub).

## Migrate from another tool

| From | Page |
| --- | --- |
| [semantic-release](https://github.com/semantic-release/semantic-release) | [migrate-from-semantic-release.md](./migrate-from-semantic-release.md) |
| [release-please](https://github.com/googleapis/release-please) | [migrate-from-release-please.md](./migrate-from-release-please.md) |
| [Changesets](https://github.com/changesets/changesets) | [migrate-from-changesets.md](./migrate-from-changesets.md) |
| [release-it](https://github.com/release-it/release-it) | [migrate-from-release-it.md](./migrate-from-release-it.md) |

## Compared with other tools

PolicySemVer is for **deployed apps** with a develop/`main` topology and **manual major**. It is not a package-graph release tool.

| Capability | PolicySemVer | semantic-release | release-please | Changesets | release-it |
| --- | --- | --- | --- | --- | --- |
| Auto Conventional Commits | Yes | Yes | Yes | No | Optional |
| Major only via env | **Yes** | No | No | Explicit file | Manual |
| `feat & fix:` | **Yes** | Custom | Custom | N/A | Custom |
| Sync prod→dev no bump | **Yes** | DIY | DIY | DIY | DIY |
| CHANGELOG + GH Release | Yes | Yes | Yes | Yes | Yes |
| Fork write-safe | **Yes** | DIY | DIY | DIY | N/A |
| Ranked classifier fixtures | **Yes** | No | No | No | No |
| Huge npm monorepo graph | Not v1 — use Changesets | Weak | Good | **Best** | DIY |

This project does not claim to be better than Changesets for monorepos.
