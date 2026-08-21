# PolicySemVer GitHub Action

Thin adapter over [`@policy-semver/core`](../core).

## Docs locks

| Lock | Decision |
| --- | --- |
| Layout | **A** — root [`action.yml`](../../action.yml) + committed root [`dist/index.js`](../../dist/index.js) (Marketplace requires root metadata) |
| Runtime | `runs.using: node24` — do **not** regress to `node20` |
| Bundle | Runners never `npm install` Action deps → **commit** the bundle |
| Bundler | **tsup** (esbuild) CJS → root `dist/index.js`. ncc failed (`TS6059` / [ncc#1297](https://github.com/vercel/ncc/issues/1297)) |
| Versioning | Consumers pin **commit SHA** (preferred) or a moving major tag (`v0` / `v1`); avoid `@main` / `@dev` in prod |

Code locks: [`src/locks.ts`](./src/locks.ts).

Dogfood path-based `uses: ./packages/action` is allowed via [`action.yml`](./action.yml) (`main: ../../dist/index.js`) — **canonical** for Marketplace / `uses: org/repo@ref` is the **repo root**.

### Bundler status

- **Tried:** `@vercel/ncc` — fails here (`TS6059` `rootDir` vs `@policy-semver/core` `.ts` exports). Tracker: [ncc#1297](https://github.com/vercel/ncc/issues/1297).
- **Actual:** **tsup** (esbuild) CJS → repo-root `dist/index.js` (`packages/action/tsup.config.ts`). No `licenses.txt` (ncc-only).
- Rebuild: `pnpm --filter @policy-semver/action build`

## Inputs / outputs

See root [`action.yml`](../../action.yml): `config-path`, `dry-run`, `token` → outputs `kind`, `next-version`, `skipped-reason`.

## Pin the Action (not npm)

This Action is distributed as **git** (`uses: org/policy-semver@<sha>` preferred, or moving major tag after release). **Do not** `npm install` / `npx` it — npm is the CLI (`policy-semver`), not the Action.

## Concurrency (required on write workflows)

Consumer workflows that run a **version write** (merged bump / tag) must set:

```yaml
concurrency:
  group: policy-semver-${{ github.repository }}-${{ github.ref }}
  cancel-in-progress: false   # never cancel mid-write
```

| Rule                          | Why                                                        |
|-------------------------------|------------------------------------------------------------|
| Stable `group` per repo + ref | Serialize overlapping bump jobs on the same branch         |
| `cancel-in-progress: false`   | Cancelling mid-write can leave VERSION / tags half-applied |

### Do not share cancel-friendly groups with lint

- Keep **lint / typecheck / unit tests** in a separate job (and a separate concurrency group, or no cancel on the write job).
- Never use one group with `cancel-in-progress: true` that includes both flaky lint and the bump write job — a new push must not cancel an in-flight write.

## Release write path

After VERSION / `package.json` / CHANGELOG are written, the Action calls `runWriteRelease` → core `runRelease`:

1. `kind === "none"` → **stop** (no commit, tag, push, or Release)
2. Else: commit with `[skip version]` → annotated tag `{tagPrefix}{version}` → push branch + tag → `repos.createRelease`

## Hooks

Config `hooks.*` are POSIX `sh -c` strings (`null` skips). Write path only (`kind !== "none"`).

| Hook | Timing | On non-zero |
| --- | --- | --- |
| `beforeBump` | Before VERSION / changelog write | Abort: files unchanged, no tag, no release |
| `afterTag` | After local annotated tag, before push | Abort remaining: local tag may exist; no push/release |
| `afterRelease` | After GitHub Release | Release already exists; remaining audit skipped |

Env: `POLICY_SEMVER_VERSION`, `POLICY_SEMVER_KIND`, `POLICY_SEMVER_DRY_RUN` (`true`/`false`). We do not delete tags or Releases on later hook failure.

## Audit trail

After a successful GitHub Release (and `hooks.afterRelease`), the Action writes `.policy-semver/last-release.json`:

```json
{
  "version": "0.1.0",
  "kind": "minor",
  "gitSha": "...",
  "tag": "v0.1.0",
  "at": "2026-08-08T00:00:00.000Z"
}
```

Then it commits that path with `[skip version]` and pushes the branch (no second tag).

**Default: commit this file** in the consumer repo. Do not gitignore `.policy-semver/` unless you explicitly want a local-only trail. This monorepo dogfood-commits the file later.

### Token / permissions

| Need | Why |
| --- | --- |
| `contents: write` | Create commit, annotated tag, GitHub Release |
| Push to **protected** branch | Token/actor must be allowed (ruleset bypass, or a bot that can push) — otherwise push fails loud |

Wire Octokit via `@actions/github` `getOctokit(token)` (locked in core `GITHUB_RELEASE_CLIENT.action`). Prefer `github.token` or a PAT stored as a secret — never log the token or pre-redact release bodies.

## Permissions (least privilege)

```yaml
permissions:
  contents: write      # commit, tag, release
  pull-requests: write # sticky dry-run comment
```

## Token when `GITHUB_TOKEN` cannot push

Branch rulesets / required reviews often block `github-actions[bot]`.

1. Prefer input `token` (defaults to `${{ github.token }}`).
2. Or set repo/org secret **`POLICY_SEMVER_TOKEN`** (PAT or GitHub App installation token with `contents: write` and ruleset bypass). Action reads `POLICY_SEMVER_TOKEN` before the input token.
3. On push failure the Action calls `core.setFailed` with an actionable message — do not swallow.

## Fork / prod / sync (runtime)

| Case | Behavior |
| --- | --- |
| Fork PR | Sticky comment OK · `allowWrite: false` |
| `base !== prodBranch` | Skip write |
| Sync `develop ← prod` | `kind: none` · no write |
| `opened` / `synchronize` / `reopened` on prod | Dry-run + sticky comment |
| `closed` + `merged` on prod (or `merge_group`) | Write → tag → release |
| `push` to prod | **Skip** (hindari double bump) |

## Consumer workflow stub

Copy [`examples/consumer.yml`](./examples/consumer.yml) into the **app** repo as `.github/workflows/policy-semver.yml`. Pin a SHA in production. This file is documentation — it is not a workflow of *this* monorepo.

Until this Action is public (or org-internal with Access enabled), `uses: besarrahmat/policy-semver@ref` 404s from another private repo. The stub **checkouts** this repo with `secrets.POLICY_SEMVER_TOKEN` (fine-grained **Contents: read** on `policy-semver`) then `uses: ./.github/actions/policy-semver`. Set `persist-credentials: false` on that checkout so the PAT is not used to push the app repo.

That checkout secret is **not** VE-42. VE-42 is a **write** token on the **consumer** (`contents: write` / ruleset bypass) passed as Action input `token` if `github-actions[bot]` cannot push `main`.
