# Migrate from release-it

[release-it](https://github.com/release-it/release-it) is usually an **interactive or CI "run release"** command (git tag + GitHub + optional npm). PolicySemVer is **PR-driven**: dry-run on open PRs, write after merge to `prodBranch`.

## Remove

- `.release-it.json` / `.release-it.yaml` / `package.json` `"release-it"`
- `npm run release` (or `npx release-it`) as the way VERSION moves
- Local `git tag` / GitHub Release steps that duplicate the Action write path

## Add

Follow the root [README quickstart](../README.md#quickstart).

| release-it | PolicySemVer |
| --- | --- |
| Increment prompt / `--ci` increment | Classifier + `APP_VERSION_MAJOR` for major |
| GitHub plugin | Action `repos.createRelease` after tag |
| `hooks` in release-it config | `hooks.beforeBump` / `afterTag` / `afterRelease` (POSIX `sh -c`, `null` skips) |
| npm publish of the **app** | Out of scope — optional `afterRelease` hook |
| `--no-git.requireCleanWorkingDir` | CLI `bump --write` requires a clean tree unless `--force` |

## Surprises

- Humans do not run a release command for the happy path. Merge the PR.
- Major is not "release-it major". Set the repository variable / env `APP_VERSION_MAJOR`.
- v1 tags are **unsigned** annotated tags (`git tag -a --no-sign`).
- Fork PRs comment only.

Stay on release-it if you want a local, interactive release with a large plugin surface (npm, GitHub, GitLab, Slack) and you are not standardizing on GitHub `pull_request` to `main`.
