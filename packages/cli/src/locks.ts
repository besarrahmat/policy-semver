/**
 * CLI docs locks
 *
 * Plan CLI artifact + tsup + `--write` on dirty tree.
 *
 * ## Artifact (plan)
 * | Field | Lock |
 * | --- | --- |
 * | npm package name | `policy-semver` (`packages/cli`) |
 * | Core library | `@policy-semver/core` via `workspace:*` — CLI is a **thin adapter** |
 * | Never re-implement | classify / SemVer math / changelog format / dual-source rules |
 * | Bin name | `policy-semver` |
 * | Published entry (after build) | `"bin": { "policy-semver": "./dist/bin.js" }` |
 * | Public CLI | `npx policy-semver@1.0.0` — workspace / `node dist/bin.js` for contrib |
 * | Public npm | `publish-locks.ts` (trusted publishing + provenance) |
 *
 * ## Build (plan tsup)
 * | Concern | Lock |
 * | --- | --- |
 * | Bundler | **tsup** → ESM (`"type": "module"`) + sourcemap |
 * | Entry | `src/bin.ts` → `dist/bin.js` |
 * | Shebang | Emitted file **must** start with `#!/usr/bin/env node` |
 * | How | tsup `banner: { js: "#!/usr/bin/env node\\n" }` (or esbuild shebang) |
 * | Why | Without shebang, `npx` / global bin → “Exec format error” / wrong interpreter |
 * | chmod in git | Not required; npm sets execute bit on install from `bin` |
 *
 * Source `src/bin.ts` has **no** shebang (avoids double-shebang with tsup banner).
 * **Build must inject** shebang via tsup `banner` — tsup does not add it by default.
 *
 * ## `--write` on dirty tree
 * | Flag | Locked behavior |
 * | --- | --- |
 * | `bump --write` | Require **clean** git working tree (no unstaged/staged/untracked that block) |
 * | Dirty + `--write` without `--force` | Exit **non-zero** (policy fail); do **not** write |
 * | `bump --write --force` | Allow dirty tree — document danger in `--help` / README |
 * | `bump --dry-run` | Always OK on dirty tree (no writes) |
 * | Default | Require explicit `--dry-run` **or** `--write` (no implicit write) |
 *
 * Clean-tree check lives in CLI adapter (git status); core bump APIs stay pure
 * wrt “dirty” — they only honor `allowWrite` / `dryRun` from the caller.
 */
export const CLI_ARTIFACT = {
  packageName: "policy-semver",
  binName: "policy-semver",
  binDistPath: "./dist/bin.js",
  coreDependency: "@policy-semver/core",
  thinAdapterOnly: true,
} as const;

export const CLI_BUILD = {
  bundler: "tsup",
  format: "esm",
  entry: "src/bin.ts",
  outFile: "dist/bin.js",
  shebang: "#!/usr/bin/env node",
  /** tsup banner js value (with trailing newline) */
  shebangBanner: "#!/usr/bin/env node\n",
} as const;

export const CLI_WRITE_GUARD = {
  /** --write requires clean tree unless --force */
  writeRequiresCleanTree: true,
  forceAllowsDirtyTree: true,
  dryRunOkOnDirty: true,
  requireExplicitDryRunOrWrite: true,
} as const;

/**
 * ## Adapter rule
 * CLI + Action → `@policy-semver/core` only.
 * Forbidden in CLI: re-parse Conventional Commits, SemVer bump math,
 * changelog section rules, dual-source match logic.
 * Allowed: argv, git status/log, loadConfig, call core, print, exit codes.
 */
export const CLI_ADAPTER = { thinOnly: true } as const;
