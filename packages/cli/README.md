# policy-semver (CLI)

Thin adapter over [`@policy-semver/core`](../core). Does **not** re-implement classify / SemVer / changelog rules.

npm CLI vs GitHub Action are **different channels**. Action install and pin-by-SHA: root [README](../../README.md#install-channels).

```bash
npx policy-semver@0.1.0 classify --help
```

## Requirements

- Node **24+**
- Repo with `versioning.config.json` (fail-closed schema)

## Build

From monorepo root:

```bash
pnpm --filter ./packages/cli build
```

`prebuild` syncs the config schema embed. Output: `dist/bin.js` (shebang `#!/usr/bin/env node`).

## Run (workspace)

```bash
pnpm policy-semver --help
# or (cwd = packages/cli — pass --cwd to the repo root for verify/bump)
pnpm --filter ./packages/cli run policy-semver -- --help
# or
node packages/cli/dist/bin.js --help
```

| Command | Behavior |
| --- | --- |
| `classify` | Print classify kind JSON |
| `bump --dry-run` | Compute next version; no write |
| `bump --write` | Write version files (clean tree unless `--force`) |
| `verify` | Load config + dual-source match + tag↔VERSION (skip if the repo has no tags yet) |
| `test` | Load `fixtures/classifier/*.json`; assert `expected.kind` (+ `warnings` if present) |

Common flags: `--config`, `--cwd`, `--title`, `--json`, `--force`.

Exit codes: `0` ok · `1` policy/validation · `2` usage.

## `--write` on dirty tree

- `--write` requires a **clean** git working tree.
- Dirty without `--force` → exit `1`, no write.
- `--force` allows dirty (dangerous — document in help).

`--write` runs `hooks.beforeBump` (if set) **before** writing VERSION / package.json. Non-zero → throw (exit `1` from bin); files unchanged. Tag/release hooks are not part of `bump` (Action / `runRelease` only).

## Dependency

```json
"@policy-semver/core": "workspace:*"
```

Core owns policy; this package owns argv, git status/log, and printing.

## How `bin` works

1. `"bin": { "policy-semver": "./dist/bin.js" }` — after install, npm/pnpm create a shim named `policy-semver` that runs that file.
2. `npx policy-semver@0.1.0 …` downloads that version and runs the shim.
3. The shim target must exist **inside the published tarball**. `"files": ["dist", "LICENSE", "README.md"]` allowlists what goes in the pack. Always **build before** pack/publish (`dist/` is gitignored).
4. Contributors run via this workspace:

```bash
pnpm --filter ./packages/cli build
pnpm policy-semver --help
node packages/cli/dist/bin.js --help
```

Inspect a tarball without publishing:

```bash
pnpm --filter ./packages/cli run pack:dry
# expect paths like: dist/bin.js, README.md
```
