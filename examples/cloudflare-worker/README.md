# Example: Cloudflare Worker

Generic [Wrangler](https://developers.cloudflare.com/workers/wrangler/) stub. The edge isolate has **no** `VERSION` file, so the version must be **injected at build** into `src/version.js`. Do not `fetch()` the version from a CDN (or any URL) on each request — caches go stale while git already moved. Same rule: [`packages/action/README.md` — App version at runtime](../../packages/action/README.md#app-version-at-runtime).

This folder is **not** a pnpm workspace member. Wrangler is not a dependency of the tool monorepo; use `npx wrangler@latest` after you copy this app out.

## Build-time inject

```bash
node scripts/inject-version.js   # reads VERSION, writes src/version.js
npx wrangler@latest dev          # or: npm run dev
```

Cloudflare-native **alternative** (not used by this stub): replace a **free** identifier at bundle time instead of generating `src/version.js`:

```bash
npx wrangler@latest deploy --define "APP_VERSION:'$(cat VERSION)'"
```

See Wrangler [`--define`](https://developers.cloudflare.com/workers/wrangler/commands/). This stub keeps `inject-version.js` so `src/worker.js` is valid JavaScript without an undeclared global.

## Classify dry-run (CLI)

From the **tool monorepo root**:

```bash
pnpm --filter ./packages/cli build
pnpm policy-semver classify --cwd examples/cloudflare-worker --title "feat: demo"
```

`git log` still walks this monorepo when the example lives here. Copy the folder to its own repo for a realistic commit list.

From a **copied app** (`npx policy-semver@1.0.0`):

```bash
npx policy-semver@1.0.0 classify --title "feat: demo"
npx policy-semver@1.0.0 classify --help
```

## Action

Replace `<full-commit-sha>` in [`.github/workflows/policy-semver.yml`](./.github/workflows/policy-semver.yml). The `build` job runs `inject-version.js` after a merged bump so the Worker bundle matches `VERSION`. This Action repo is public. A **private fork** still 404s from another private repo — use the checkout workaround in [`packages/action/README.md`](../../packages/action/README.md#consumer-workflow-stub). Root [README quickstart](../../README.md#quickstart). Set `APP_VERSION_MAJOR=0`.
