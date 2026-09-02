# PolicySemVer GitHub Action

Thin adapter over [`@policy-semver/core`](../core).

Consumer install (dry-run in under 15 minutes): root [README quickstart](../../README.md#quickstart). Pin a commit SHA; do not `npm install` this Action.

## Docs locks

| Lock | Decision |
| --- | --- |
| Layout | **A** — root [`action.yml`](../../action.yml) + committed root [`dist/index.js`](../../dist/index.js) (Marketplace requires root metadata) |
| Marketplace | **Live** — [PolicySemVer](https://github.com/marketplace/actions/policysemver) (`v1.0.0`). `name: PolicySemVer`, branding `tag` / `blue`, categories Continuous integration + Publishing. |
| Runtime | `runs.using: node24` — do **not** regress to `node20` |
| Bundle | Runners never `npm install` Action deps → **commit** the bundle |
| Bundler | **tsup** (esbuild) CJS → root `dist/index.js`. ncc failed (`TS6059` / [ncc#1297](https://github.com/vercel/ncc/issues/1297)) |
| Versioning | Consumers pin **commit SHA** (preferred) or a moving major tag (`v0` / `v1`); avoid `@main` / `@dev` in prod |

Code locks: [`src/locks.ts`](./src/locks.ts), [`src/marketplace-locks.ts`](./src/marketplace-locks.ts).

Dogfood path-based `uses: ./packages/action` is allowed via [`action.yml`](./action.yml) (`main: ../../dist/index.js`) — **canonical** for Marketplace / `uses: org/repo@ref` is the **repo root**. Subfolder metadata is **not** auto-listed.

### GitHub Marketplace

**Live:** [PolicySemVer on GitHub Marketplace](https://github.com/marketplace/actions/policysemver). Keep the Marketplace checkbox on later Releases. Do not mint a `v0.*` tag only to refresh the listing (that triggers npm `publish.yml`). Production still pins a SHA.

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
  group: policy-semver-${{ github.repository }}-${{ github.event.pull_request.base.ref || github.event.merge_group.base_ref }}
  cancel-in-progress: false   # never cancel mid-write
```

| Rule | Why |
| --- | --- |
| Group per repo + **prod base** | Serialize overlapping merges into the same `prodBranch`. Use `pull_request.base.ref` or `merge_group.base_ref` (not `github.ref` — on `pull_request` that is `refs/pull/N/merge`) |
| `cancel-in-progress: false` | Cancelling mid-write can leave VERSION / tags half-applied |

### Do not share cancel-friendly groups with lint

- Keep **lint / typecheck / unit tests** in a separate job (and a separate concurrency group, or no cancel on the write job).
- Never use one group with `cancel-in-progress: true` that includes both flaky lint and the bump write job — a new push must not cancel an in-flight write.

## Release write path

After VERSION / `package.json` / CHANGELOG are written, the Action calls `runWriteRelease` → core `runRelease`:

1. `kind === "none"` → **stop** (no commit, tag, push, or Release)
2. Else: commit with `[skip version]` → annotated tag `{tagPrefix}{version}` → push `HEAD:{prodBranch}` + tag → `repos.createRelease`

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

## Branch protection

The Action **skips `push` events**, so a direct push to `prodBranch` does not bump. That is not enough: a human can still push VERSION / tags by hand.

On the **consumer** repo, protect `prodBranch` (default `main`):

1. GitHub → **Settings → Rules → Rulesets → New branch ruleset** (or classic **Settings → Branches**).
2. Target `main` (or the branch named in `versioning.config.json` `prodBranch`).
3. Enable **Require a pull request before merging**, **Block force pushes**, **Restrict deletions**.
4. Enforcement: **Active**.

Do the same on the **tool** repo (`policy-semver`) for `main`. Work stays on `dev`; only `dev` → `main` PRs land on production.

## Token when `GITHUB_TOKEN` cannot push

Branch rulesets / required reviews often block `github-actions[bot]`. The write path must **fail loud** (`core.setFailed`) — do not swallow a denied push.

1. Prefer input `token` (defaults to `${{ github.token }}`).
2. Or set repo/org secret **`POLICY_SEMVER_TOKEN`** (PAT or GitHub App installation token with `contents: write` and ruleset bypass). Action reads `POLICY_SEMVER_TOKEN` before the input token.
3. On the **consumer** ruleset **Bypass list**, add that App (or the user that owns the PAT) so the bump commit can land on protected `main`. Do not add "everyone". Prefer **Always allow** only for that dedicated bot — not for personal admin accounts.
4. Pass the same write token to **app** `actions/checkout` (`token:`) so `git push` can update prod. Action input `token` is Octokit (Release + comments) only.

That write token is **not** the checkout PAT used to `uses:` a private Action repo (Contents: **read** on `policy-semver` only).

## Fork / prod / sync (runtime)

| Case | Behavior |
| --- | --- |
| Fork PR | Sticky comment OK · `allowWrite: false` |
| `base !== prodBranch` | Skip write |
| Sync `develop ← prod` | `kind: none` · no write |
| `opened` / `synchronize` / `reopened` on prod | Dry-run + sticky comment |
| `closed` + `merged` on prod (or `merge_group`) | Write → tag → release |
| `push` to prod | **Skip** (avoids a double bump) |

## Merge methods

Classify uses the **final subjects** visible when the job runs: `pulls.listCommits` when there is a PR, otherwise `git log` (`load-commits.ts`) — including `merge_group`.

| Method | What is classified |
| --- | --- |
| **Rebase merge** | Rebased commit subjects (not `Merge branch…`) |
| **Squash** | PR title + squash subject |
| **Merge commit** | `Merge pull request…` subjects are ignored; commits inside the PR still aggregate |

`merge_group` is treated as a write. If merge queue **and** `pull_request` `closed+merged` both write, the second job can hit tag-exists. Pick **one** write trigger per consumer.

## Revert

A revert does **not** roll VERSION back. Subject `Revert "feat: …"` is other → **patch** (not a downgrade). To republish an older number, set VERSION and the tag by hand, or raise major via env.

## Cherry-pick onto a feature branch

A PR whose base is not `prodBranch` (including cherry-picking a bump commit onto `feat/…`) → **skip / no write**. Bump only after merge to prod.

## `release/*`

`release/1.2` is ignored unless `versioning.config.json` `prodBranch` is that branch.

## Mirror tags

If `origin` (or a mirror) already has `{tagPrefix}{version}` at a different SHA → **fail** (`mirror tag conflict`). Tags are never force-pushed. Fetch tags (`fetch-depth: 0`).

## Long-lived PR + hotfix

The Action reads VERSION from `origin/{prodBranch}` (dry-run and write), not the feature-branch tree. Sticky comment refreshes on `opened` / `synchronize` / `reopened`. After a hotfix lands on prod, re-run / push the long-lived PR so next-version follows prod HEAD.

## Signed tags

v1 creates **unsigned** annotated tags (`git tag -a --no-sign`). Do not set `tag.gpgSign` on the runner without a key — signing is not the default; there is no `signedTags` config key (unknown keys fail-closed).

## Prerelease / beta

Beta channels / `1.0.0-beta.1` are **out of scope for v1**. Default off. Do not add a `prerelease` key to config until the schema is extended.

## Consumer workflow stub

Copy [`examples/consumer.yml`](./examples/consumer.yml) into the **app** repo as `.github/workflows/policy-semver.yml`. Pin a SHA in production. This file is documentation — it is not a workflow of *this* monorepo.

Keep **bump → build → deploy**. The stub's `build` job `needs: version`; `deploy` `needs: build`. Both run only after a merged PR. A failed or skipped `version` job skips `build`/`deploy` because of `needs:`. Do not use `if: always()` on deploy. Do not put deploy steps in the version job.

The stub uses public `uses: besarrahmat/policy-semver@<sha>` (Marketplace layout A). Demo `@v1.0.0` is OK. A **private fork** still 404s from another private repo — the same file has a commented checkout workaround (`secrets.POLICY_SEMVER_TOKEN` with Contents: **read** on `policy-semver`, then `uses: ./.github/actions/policy-semver`, `persist-credentials: false` so that PAT is not used to push the app repo).

<!-- The Action-repo checkout PAT (Contents: read) is not the consumer write token. If github-actions[bot] cannot push main, pass a contents:write / ruleset-bypass token as Action input `token`. -->

## App version at runtime

Bake `VERSION` / `package.json` `version` into the **build** (define / `import.meta.env` / Next `env` at compile). Do not read the version from a CDN on each request — caches go stale while git already moved.
