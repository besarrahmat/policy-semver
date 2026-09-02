/**
 * Phase 12.A — GitHub Marketplace locks
 *
 * Official refs:
 * - https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
 * - https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax
 * - https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement
 *
 * Re-verified: 2026-09-01 (publish-in-github-marketplace + metadata-syntax branding).
 *
 * **Listing is live:** https://github.com/marketplace/actions/policysemver
 * (Release `v0.1.0`, 2026-09-01). GitHub publishes Actions from a Release
 * checkbox (not from `publish.yml` / npm). Do **not** create a new `v0.*` tag
 * solely to refresh the listing — that workflow publishes npm. Keep the
 * Marketplace checkbox on later Releases so new versions stay listed.
 *
 * ## Prerequisites (GitHub docs)
 * | Requirement | Lock |
 * | --- | --- |
 * | Repository | **public** |
 * | Metadata | Single `action.yml` at **repo root** (layout A). Subfolder `action.yml` is not auto-listed |
 * | Filename | Keep `action.yml`. Renaming to `action.yaml` after listing hides prior Marketplace versions |
 * | `name` | Unique vs existing Marketplace actions, GitHub users/orgs you do not own, Marketplace categories, reserved GitHub feature names |
 * | Account | **2FA** on (required to publish a Release to Marketplace) |
 * | Legal | Accept **GitHub Marketplace Developer Agreement** before the publish checkbox enables |
 *
 * ## Metadata (root `action.yml`)
 * Short description must mention **deployed apps** and **major via env**.
 * `branding.icon` is Feather v4.28.0 (`tag` is in the exhaustive list).
 * `branding.color` is one of: white, black, yellow, blue, green, orange, red,
 * purple, gray-dark.
 *
 * Categories are **not** in `action.yml` — pick them on the Release form.
 *
 * ## Operator
 * Later Releases: keep **Publish this Action to the GitHub Marketplace**
 * checked. Categories already set (Continuous integration / Publishing).
 * Production consumers still pin a commit SHA; Marketplace is discoverability.
 */
export const MARKETPLACE_DOCS = {
  publish:
    "https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace",
  metadataSyntax:
    "https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax",
  developerAgreement:
    "https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement",
  reVerified: "2026-09-01",
} as const;

export const MARKETPLACE_METADATA = {
  filename: "action.yml",
  doNotRenameToActionYaml: true,
  name: "PolicySemVer",
  description:
    "Policy-first SemVer for deployed apps; major only via APP_VERSION_MAJOR",
  author: "Besar Rahmat",
  branding: {
    icon: "tag",
    color: "blue",
  },
  /** Practical card length; GitHub metadata docs do not set a hard max. */
  maxDescriptionChars: 125,
} as const;

/** Feather v4.28.0 colors from metadata-syntax (re-verified 2026-09-01). */
export const MARKETPLACE_BRANDING_COLORS = [
  "white",
  "black",
  "yellow",
  "blue",
  "green",
  "orange",
  "red",
  "purple",
  "gray-dark",
] as const;

export const MARKETPLACE_CATEGORIES = {
  /** Chosen on the GitHub Release form, not in action.yml. */
  pickedAtPublishTime: true,
  primary: "Continuous integration",
  secondary: "Publishing",
} as const;

export const MARKETPLACE_LISTING = {
  status: "live",
  listedOn: "2026-09-01",
  listedFromRelease: "v0.1.0",
  liveUrl: "https://github.com/marketplace/actions/policysemver",
  uniquenessCheckedOn: "2026-09-01",
  /** Pre-list search: zero Marketplace hits for PolicySemVer. */
  nameWasUniqueAtListTime: true,
  githubUserOrOrgDidNotExist: true,
} as const;

export const MARKETPLACE_OPERATOR = {
  twoFactorRequired: true,
  developerAgreementRequired: true,
  publishViaReleaseCheckbox: true,
  doNotCreateTagOnlyToList: true,
  consumersPinSha: true,
} as const;
