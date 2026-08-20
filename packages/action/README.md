# PolicySemVer GitHub Action

Thin adapter over [`@policy-semver/core`](../core). Runtime wiring lands in Phase 6.B+; this README locks **docs-gate** decisions (6.A) plus earlier concurrency/release notes.

## 6.A Docs locks

| Lock | Decision |
| --- | --- |
| Layout | **A** — root [`action.yml`](../../action.yml) + committed root [`dist/index.js`](../../dist/index.js) (Marketplace requires root metadata) |
| Runtime | `runs.using: node24` — do **not** regress to `node20` |
| Bundle | Runners never `npm install` Action deps → **commit** the bundle |
| Bundler | Try **`@vercel/ncc` first**; fallback rollup / esbuild if Node 24/ESM breaks ncc ([ncc#1297](https://github.com/vercel/ncc/issues/1297)) — document any switch here |
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

## Token when `GITHUB_TOKEN` cannot push (VE-42)

Branch rulesets / required reviews often block `github-actions[bot]`.

1. Prefer input `token` (defaults to `${{ github.token }}`).
2. Or set repo/org secret **`POLICY_SEMVER_TOKEN`** (PAT or GitHub App installation token with `contents: write` and ruleset bypass). Action reads `POLICY_SEMVER_TOKEN` before the input token.
3. On push failure the Action calls `core.setFailed` with an actionable message — do not swallow.

## Fork / prod / sync (runtime)

| Case | Behavior |
| --- | --- |
| Fork PR | Sticky comment OK · `allowWrite: false` |
| `base !== prodBranch` | Skip write |
| Sync `develop ← prod` | `kind: none` · no write (VF-03) |
| `opened` / `synchronize` / `reopened` on prod | Dry-run + sticky comment |
| `closed` + `merged` on prod (or `merge_group`) | Write → tag → release |
| `push` to prod | **Skip** (hindari double bump VE-13) |
