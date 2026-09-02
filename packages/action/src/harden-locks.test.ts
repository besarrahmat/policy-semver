import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  HARDEN_AUDIT,
  HARDEN_PERMISSIONS,
  HARDEN_RUNTIME,
  SECURITY_CHECKLIST,
} from "./harden-locks.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

it("locks 12.C harden flags", () => {
  expect(HARDEN_AUDIT.date).toBe("2026-09-01");
  expect(HARDEN_AUDIT.actionsGithubMin).toBe("9.1.1");
  expect(HARDEN_AUDIT.nanoidOverride).toBe("3.3.18");
  expect(HARDEN_AUDIT.esbuildOverride).toBe("^0.28.1");
  expect(HARDEN_RUNTIME.forkRefuseWrite).toBe(true);
  expect(HARDEN_RUNTIME.redactReleaseBodies).toBe(true);
  expect(HARDEN_RUNTIME.pinShaRecommended).toBe(true);
  expect(HARDEN_RUNTIME.examplesPublishedChannels).toBe(true);
  expect(read("BLOCKERS.md")).toMatch(/esbuild/);
  expect(read("BLOCKERS.md")).toMatch(/resolved/);
  expect(read("pnpm-workspace.yaml")).toMatch(/nanoid@\^3:\s*3\.3\.18/);
  expect(read("pnpm-workspace.yaml")).toMatch(/esbuild:\s*"\^0\.28\.1"/);
  expect(read("pnpm-lock.yaml")).not.toMatch(/esbuild@0\.27/);
  const actionPkg = JSON.parse(read("packages/action/package.json")) as {
    dependencies?: Record<string, string>;
  };
  expect(actionPkg.dependencies?.["@actions/github"]).toMatch(/9\.1\.1/);
});

it("SECURITY.md supports 1.x and drops pre-release language", () => {
  const security = read("SECURITY.md");
  expect(security).toMatch(/`1\.x`/);
  expect(security).toMatch(/`1\.0\.x`/);
  expect(security).toMatch(/Yes/);
  expect(security).toMatch(/`0\.1\.x`/);
  expect(security).toMatch(/pre-`0\.1\.0`/);
  expect(security).not.toMatch(/when published/);
  expect(security).not.toMatch(/Until the first public release/);
});

it("Action and CI workflows stay least-privilege", () => {
  const consumer = read("packages/action/examples/consumer.yml");
  const dogfood = read(".github/workflows/policy-semver.yml");
  const example = read("examples/node-app/.github/workflows/policy-semver.yml");
  const worker = read(
    "examples/cloudflare-worker/.github/workflows/policy-semver.yml",
  );
  for (const yml of [consumer, dogfood, example, worker]) {
    expect(yml).toMatch(/contents:\s*write/);
    expect(yml).toMatch(/pull-requests:\s*write/);
    expect(yml).not.toMatch(/id-token:\s*write/);
    expect(yml).not.toMatch(/issues:\s*write/);
  }
  const ci = read(".github/workflows/ci.yml");
  expect(ci).toMatch(/contents:\s*read/);
  expect(ci).not.toMatch(/contents:\s*write/);
  for (const perm of HARDEN_PERMISSIONS.ci) {
    expect(ci).toContain(perm);
  }
  const publish = read(".github/workflows/publish.yml");
  expect(publish).toMatch(/contents:\s*read/);
  expect(publish).toMatch(/id-token:\s*write/);
  const review = read(".github/workflows/dependency-review.yml");
  expect(review).toMatch(/dependency-review-action@v5/);
  expect(review).toMatch(/fail-on-severity:\s*high/);
  expect(read(".github/dependabot.yml")).toMatch(/package-ecosystem:\s*npm/);
  expect(read(".github/dependabot.yml")).toMatch(
    /package-ecosystem:\s*github-actions/,
  );
});

it("README still recommends pin-by-SHA for production", () => {
  const readme = read("README.md");
  expect(readme).toMatch(/## Pin by SHA/);
  expect(readme).toMatch(/full commit SHA/);
  expect(readme).toMatch(/uses: besarrahmat\/policy-semver@<full-commit-sha>/);
});

it("examples use published Action/npm, not file: installs", () => {
  for (const dir of ["examples/node-app", "examples/cloudflare-worker"]) {
    const pkg = read(`${dir}/package.json`);
    expect(pkg).not.toMatch(/"file:/);
    expect(pkg).not.toMatch(/@policy-semver\//);
    const wf = read(`${dir}/.github/workflows/policy-semver.yml`);
    expect(wf).toMatch(/uses:\s*besarrahmat\/policy-semver@<full-commit-sha>/);
    expect(wf).not.toMatch(/uses:\s*\.\//);
    expect(read(`${dir}/README.md`)).toMatch(/npx policy-semver@1\.0\.0/);
  }
});

it("standing security checklist stays locked", () => {
  expect(SECURITY_CHECKLIST.leastPrivilegeAction).toBe(true);
  expect(SECURITY_CHECKLIST.forkCommentOnly).toBe(true);
  expect(SECURITY_CHECKLIST.redactLogsAndReleaseBodies).toBe(true);
  expect(SECURITY_CHECKLIST.documentPolicySemverToken).toBe(true);
  expect(SECURITY_CHECKLIST.oidcPublishPreferred).toBe(true);
  expect(SECURITY_CHECKLIST.neverCommitEnvOrTokens).toBe(true);

  const contributing = read("CONTRIBUTING.md");
  expect(contributing).toMatch(/## Security/);
  expect(contributing).toMatch(/contents:\s*write/);
  expect(contributing).toMatch(/Fork PRs/);
  expect(contributing).toMatch(/redactSecrets/);
  expect(contributing).toMatch(/POLICY_SEMVER_TOKEN/);
  expect(contributing).toMatch(/OIDC/);
  expect(contributing).toMatch(/Never commit `\.env`/);
  expect(contributing).not.toMatch(/IMPLEMENTATION-PLAN/);

  expect(read("README.md")).toMatch(/POLICY_SEMVER_TOKEN/);
  expect(read("packages/action/README.md")).toMatch(/POLICY_SEMVER_TOKEN/);
  expect(read("packages/action/README.md")).toMatch(/GitHub App/);
  expect(read("packages/action/src/decision.ts")).toMatch(/isFork/);
  expect(read("packages/core/src/github/create-release.ts")).toMatch(
    /redactSecrets/,
  );
  expect(read("packages/core/src/changelog/write-changelog.ts")).toMatch(
    /redactSecrets/,
  );
  expect(read("packages/action/src/run-action.ts")).not.toMatch(
    /core\.(info|debug|warning)\([^)]*token/,
  );

  const publish = read(".github/workflows/publish.yml");
  expect(publish).toMatch(/id-token:\s*write/);
  expect(publish).not.toMatch(/secrets\.(NPM_TOKEN|NODE_AUTH_TOKEN)/);

  const gitignore = read(".gitignore");
  expect(gitignore).toMatch(/^\.env$/m);
  expect(gitignore).toMatch(/^\.env\.\*$/m);
  expect(read(".npmrc")).not.toMatch(/_authToken/);
});
