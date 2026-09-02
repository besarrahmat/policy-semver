/**
 * Final launch gate — public v1 surface.
 *
 * Keep these true: npm CLI + Action (Marketplace / SHA), this repo as source
 * of truth, second consumer on published artifacts, Quickstart under 15
 * minutes, differentiators announced, not a Changesets graph replacement.
 */
export const LAUNCH = {
  npmCli: "npx policy-semver@0.1.0",
  marketplaceUrl: "https://github.com/marketplace/actions/policysemver",
  pinBySha: "besarrahmat/policy-semver@<full-commit-sha>",
  quickstartUnder15Minutes: true,
  consumersDependOnPublishedArtifacts: true,
  differentiators: [
    "major via env",
    "feat & fix:",
    "sync prod→dev without a bump",
    "ranked classifier fixtures",
  ] as const,
  nonClaimChangesetsGraph: true,
  communityFiles: ["LICENSE", "SECURITY.md", "CODE_OF_CONDUCT.md"] as const,
} as const;
