# Migrate from Changesets

**No monorepo graph parity.** PolicySemVer does not version interdependent packages, does not consume `.changeset/*.md` files, and does not claim to be better than Changesets for monorepos. If you need a package graph (independent versions, internal dependency bumps, canaries), **keep Changesets**.

## When a move is reasonable

A **single deployed app** (or a repo that only versions the root) that wants PR-driven SemVer, develop/`main` sync without a bump, and major only via env.

## Remove

- `.changeset/` (config + markdown files)
- `@changesets/cli` scripts (`changeset`, `version`, `publish`)
- `changesets/action` in GitHub Actions
- Expectations that `packages/foo` and `packages/bar` bump on their own

## Add

Follow the root [README quickstart](../README.md#quickstart). Commits/PR titles replace changeset files: see the [cheat sheet](../CONTRIBUTING.md#commit-cheat-sheet).

| Changesets | PolicySemVer |
| --- | --- |
| Human writes a changeset per PR | Classifier reads subjects (`feat:` / `fix:` / `docs:`) |
| `major` / `minor` / `patch` in the markdown file | Kind from subjects; **major only** via `APP_VERSION_MAJOR` |
| Independent or locked workspace versions | Same version via extra `versionFiles` paths; no independent graph |
| `changesets/action` version + publish | Action dry-run comment; write on merge to `prodBranch` |
| Linked packages / ignore list | Not v1 |

This repository locksteps npm CLI/core with root `VERSION` through extra `versionFiles` entries. That is **not** a Changesets package graph.

## Surprises

- No snapshot/canary workflow.
- `feat & fix:` is a first-class **minor**.
- Docs-only PRs do not bump.
- Fork PRs never write.

Stay on Changesets for a huge npm monorepo graph. That is the honest split — not a temporary gap you should paper over with PolicySemVer path filters. v1 **Option B:** no `workspaces` config key (unknown key fail-closed); path-filter MVP is 0.2.
