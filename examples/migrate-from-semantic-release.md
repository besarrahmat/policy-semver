# Migrate from semantic-release

PolicySemVer classifies Conventional subjects and writes VERSION / changelog / GitHub Release from a GitHub Action. It does **not** replace semantic-release's npm-publish plugin graph, and it **never** auto-majors from `BREAKING CHANGE` or `feat!:`.

## Remove

- `release.config.js` / `.releaserc.*` / `package.json` `"release"`
- CI jobs that run `npx semantic-release` (and plugins such as `@semantic-release/npm`, `@semantic-release/github`, `@semantic-release/git`)
- Branch maps that auto-promote `feat!:` to major

## Add

Follow the root [README quickstart](../README.md#quickstart): `versioning.config.json`, aligned `VERSION` / `package.json` version, workflow pinned by SHA.

Map roughly:

| semantic-release | PolicySemVer |
| --- | --- |
| `branches` production name | `prodBranch` (default `main`) |
| `@semantic-release/github` | Action write path → GitHub Release |
| `@semantic-release/changelog` / git commit of notes | `changelogPath` + bump commit |
| `@semantic-release/npm` (publish the **app**) | Out of scope — optional `hooks.afterRelease` |
| `BREAKING CHANGE` → major | Warning only; set `APP_VERSION_MAJOR` |

## Surprises

- Open PRs are **dry-run comments**, not a release. Merge to `prodBranch` is the write.
- `feat!:` stays **minor** (plus a warning) unless you raise major via env.
- Dual-source: if both `VERSION` and `package.json` exist, they must match.
- v1 versions the **repo root** only.

Stay on semantic-release if the product is an npm library whose release *is* `npm publish` from Conventional Commits, including auto-major.
