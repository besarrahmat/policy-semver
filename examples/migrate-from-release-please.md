# Migrate from release-please

[release-please](https://github.com/googleapis/release-please) opens a long-lived **release PR** and versions from Conventional Commits. PolicySemVer comments on each feature PR (dry-run) and writes on **merge to production**. It does not manage a multi-package manifest.

## Remove

- `release-please-config.json` / `.release-please-manifest.json`
- `googleapis/release-please-action` (or the `release-please` CLI in CI)
- Component / package path entries if you expected independent package bumps — **v1 is root-only**

## Add

Follow the root [README quickstart](../README.md#quickstart).

| release-please | PolicySemVer |
| --- | --- |
| Release PR that accumulates changelog | Sticky dry-run on the feature PR; bump commit after merge |
| `include-v-in-tag` | `tagPrefix` (default `v`) |
| `bump-minor-pre-major` / extra-files | 0.x: feat is still minor; major only via `APP_VERSION_MAJOR` |
| Manifest of many packages | Not v1 — see [Changesets migration](./migrate-from-changesets.md) |
| `bootstrap-sha` | Seed `VERSION` / `package.json` yourself |

## Surprises

- There is **no** release PR. The version job runs on `pull_request` to `prodBranch`.
- `BREAKING CHANGE` / `feat!:` do not major.
- Sync `main` → `dev` does not bump.
- `release/*` branches are ignored unless `prodBranch` is that name.

Stay on release-please if you want a single release PR per repo/component and a monorepo manifest. PolicySemVer is the better fit when production is a deployed app with develop/`main` and **manual** major.
