/**
 * Testing layers — keep green on every PR to `dev`.
 *
 * Do **not** delete files under `fixtures/classifier/` to make CI pass.
 * Add a case or fix `classify`.
 */
export const TESTING_CI = {
  workflow: ".github/workflows/ci.yml",
  pullRequestBranches: ["dev", "main"] as const,
  unitCommand: "pnpm test",
  goldenCommand: "pnpm test:fixtures",
} as const;

export const TESTING_LAYERS = {
  unit: {
    what: "classify, SemVer math, config validate, redact",
    files: [
      "packages/core/src/classify/classify.test.ts",
      "packages/core/src/bump/parse-version.test.ts",
      "packages/core/src/config/load-config.test.ts",
      "packages/core/src/github/redact.test.ts",
    ],
  },
  golden: {
    what: "fixtures/classifier/*.json",
    dir: "fixtures/classifier",
  },
  integration: {
    what: "temp dir bump + changelog",
    files: [
      "packages/core/src/bump/bump.test.ts",
      "packages/core/src/changelog/write-changelog.test.ts",
    ],
  },
  actionSmoke: {
    what: "Action decision matrix + consumer stub",
    files: [
      "packages/action/src/decision.test.ts",
      "packages/action/examples/consumer.yml",
    ],
  },
  dogfood: {
    what: "this repo on PRs targeting main",
    workflow: ".github/workflows/policy-semver.yml",
  },
} as const;

/** Filenames that must stay on disk. Removing one to green CI is forbidden. */
export const REQUIRED_CLASSIFIER_FIXTURES = [
  "feat-plain.json",
  "feat-scope.json",
  "feat-and-fix.json",
  "docs-only.json",
  "fix-patch.json",
  "feature-typo-patch.json",
  "emoji-feat.json",
  "merge-ignored.json",
  "title-feat-docs-commits.json",
  "breaking-warn-only.json",
  "major-env-reset.json",
  "squash-pr-title.json",
  "feat-uppercase.json",
  "merge-only.json",
  "title-docs-feat-commit.json",
  "docs-scope.json",
  "feat-amp-fix.json",
  "empty-pr.json",
  "major-skip-1-to-3.json",
  "skip-true.json",
  "dependabot-bump.json",
  "feat-in-body-only.json",
  "breaking-body-warn-only.json",
] as const;
