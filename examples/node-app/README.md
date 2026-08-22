# Example: Node app

Minimal consumer: dual-source `VERSION` + `package.json`, PolicySemVer workflow, and a process that **displays the version** (console + `GET /` / `GET /version`).

This folder is **not** a pnpm workspace member. Copy it to its own GitHub repo — do not import `@policy-semver/core` from the tool monorepo.

## Run

Requires Node **24+**. No `npm install`.

```bash
node server.js
# console: policy-semver-example-node-app 0.0.0
curl -s http://127.0.0.1:3000/version
# 0.0.0
```

The process reads `VERSION` and `package.json` **once at start** from the deploy artifact. Do not fetch the version from a CDN on each request.

## Classify dry-run (CLI)

Until `policy-semver` is on public npm, from the **tool monorepo root** (build the CLI first):

```bash
pnpm --filter ./packages/cli build
pnpm policy-semver classify --cwd examples/node-app --title "feat: demo"
```

`git log` still walks this monorepo when the example lives here. Copy the folder to its own repo for a realistic commit list.

After public `0.1.0`, from **this app's root**:

```bash
npx policy-semver@0.1.0 classify --title "feat: demo"
npx policy-semver@0.1.0 classify --help
```

## Action

Replace `<full-commit-sha>` in [`.github/workflows/policy-semver.yml`](./.github/workflows/policy-semver.yml). Until the Action repo is public, `uses: besarrahmat/policy-semver@…` 404s from another private repo — use the checkout workaround in [`packages/action/README.md`](../../packages/action/README.md#consumer-workflow-stub) (Consumer workflow stub). Root [README quickstart](../../README.md#quickstart). Set repository variable `APP_VERSION_MAJOR=0`.
