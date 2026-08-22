# policy-semver (CLI)

Thin adapter over [`@policy-semver/core`](../core). Does **not** re-implement classify / SemVer / changelog rules.

> Package is still `private` until publish phase. Use workspace build locally — do not expect public `npx` yet.

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
# or
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
2. `npx policy-semver@x.y.z …` would download that version and run the shim — **not available yet** (`private: true` until publish phase).
3. The shim target must exist **inside the published tarball**. `"files": ["dist", "README.md"]` allowlists what goes in the pack. Always **build before** pack/publish (`dist/` is gitignored).
4. Until publish phase, run only via workspace:

```bash
pnpm --filter ./packages/cli build
pnpm policy-semver --help
node packages/cli/dist/bin.js --help
```

Inspect the future tarball without publishing:

```bash
pnpm --filter ./packages/cli run pack:dry
# expect paths like: dist/bin.js, README.md
```
