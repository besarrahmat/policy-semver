/**
 * Public npm / provenance locks
 *
 * Official refs:
 * - https://docs.npmjs.com/trusted-publishers/
 * - https://docs.npmjs.com/generating-provenance-statements
 *
 * Re-verified: 2026-09-01 (npm docs last-edited 2026-06-04 / 2026-05-04).
 *
 * **0.1.0 is on the registry** (laptop publish, no OIDC attestation). Do **not**
 * unpublish or overwrite it. Next provenance publish is **0.1.1** from
 * `.github/workflows/publish.yml` (tag `v0.1.1`) after Trusted Publisher is set
 * on both packages. Root and `@policy-semver/action` stay `"private": true`.
 *
 * ## Trusted publishing (OIDC)
 * | Requirement | Lock |
 * | --- | --- |
 * | Auth | OIDC trusted publisher — prefer over long-lived `NPM_TOKEN` |
 * | npm CLI on publisher job | **≥ 11.5.1** (`npm install -g npm@latest` if needed) |
 * | Node on publisher job | **24+** (`.node-version`; npm docs allow 22.14.0+, we stay on 24) |
 * | Permission | `id-token: write` (plus `contents: read`) |
 * | Runner | GitHub-**hosted** (`ubuntu-latest`). Self-hosted is not supported |
 * | Workflow filename | **`publish.yml`** — exact, including `.yml`, case-sensitive |
 * | npmjs.com Trusted Publisher | owner `besarrahmat`, repo `policy-semver`, file `publish.yml` |
 * | `package.json` `repository.url` | `git+https://github.com/besarrahmat/policy-semver.git` (must match) |
 * | setup-node `registry-url` | **Omit** when publishing via OIDC without `NODE_AUTH_TOKEN`. An empty `_authToken` from setup-node → `ENEEDAUTH` and OIDC never runs. Official examples still show `registry-url`; this repo follows the ENEEDAUTH lock. |
 *
 * ## Provenance
 * Trusted publishing from GitHub Actions **auto-generates** provenance (no
 * `--provenance` required). Still set `publishConfig.provenance` /
 * `NPM_CONFIG_PROVENANCE=true` as belt-and-suspenders.
 * Provenance needs a **public** GitHub repo **and** a public package.
 * Private source repos cannot publish provenance attestations.
 *
 * ## Packages
 * | Name | Access | Channel |
 * | --- | --- | --- |
 * | `policy-semver` | public | npm CLI |
 * | `@policy-semver/core` | public | npm library |
 * | `@policy-semver/action` | never npm | git `uses:` only |
 * | `policy-semver-monorepo` (root) | `"private": true` forever | not published |
 *
 * Publish **core first**, then CLI. `workspace:*` is rewritten on pack/publish.
 *
 * `files` allowlist: `dist`, `LICENSE`, `README.md`.
 *
 * ## Operator
 * npm account 2FA on. GitHub repo is **public**. Attach Trusted Publisher on
 * npmjs.com for **both** `policy-semver` and `@policy-semver/core` (owner
 * `besarrahmat`, repo `policy-semver`, file `publish.yml`, allow `npm publish`,
 * environment empty) before the first OIDC tag publish.
 *
 * ## Immutability
 * Published versions cannot be overwritten. Fixes are `0.1.1`, not a republish
 * of `0.1.0`. Prefer `npm deprecate` over unpublish except npm's severe-security path.
 */
export const NPM_TRUSTED_PUBLISH = {
  docsTrustedPublishers: "https://docs.npmjs.com/trusted-publishers/",
  docsProvenance: "https://docs.npmjs.com/generating-provenance-statements",
  minNpmCli: "11.5.1",
  minNodeDocs: "22.14.0",
  nodeOnPublisher: "24",
  nodeVersionFile: ".node-version",
  idTokenPermission: "id-token: write",
  githubHostedOnly: true,
  workflowFilename: "publish.yml",
  githubOwner: "besarrahmat",
  githubRepo: "policy-semver",
  repositoryUrl: "git+https://github.com/besarrahmat/policy-semver.git",
  omitSetupNodeRegistryUrl: true,
  omitSetupNodeRegistryUrlReason:
    "empty NODE_AUTH_TOKEN writes _authToken and OIDC never runs (ENEEDAUTH)",
} as const;

export const NPM_PROVENANCE = {
  automaticUnderTrustedPublish: true,
  requiresPublicGitHubRepo: true,
  requiresPublicPackage: true,
  privateSourceRepoCannotAttest: true,
  publishConfigProvenance: true,
} as const;

export const NPM_PACKAGES = {
  firstPublicVersion: "0.1.0",
  access: "public",
  publishOrder: ["@policy-semver/core", "policy-semver"] as const,
  cli: {
    name: "policy-semver",
    directory: "packages/cli",
    files: ["dist", "LICENSE", "README.md"] as const,
  },
  core: {
    name: "@policy-semver/core",
    directory: "packages/core",
    files: ["dist", "LICENSE", "README.md"] as const,
  },
  neverPublish: ["@policy-semver/action", "policy-semver-monorepo"] as const,
  publishConfig: {
    access: "public",
    provenance: true,
  },
  versionsImmutable: true,
} as const;

export const NPM_OPERATOR = {
  twoFactorRequired: true,
  scopeOrg: "@policy-semver",
  expect404UntilFirstPublish: false,
  firstPublicVersionPublishedWithoutOidcProvenance: true,
  nextOidcPublishVersion: "0.1.1",
} as const;
