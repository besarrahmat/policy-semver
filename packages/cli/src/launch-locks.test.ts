import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { LAUNCH } from "./launch-locks.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

it("locks launch flags", () => {
  expect(LAUNCH.npmCli).toBe("npx policy-semver@1.0.0");
  expect(LAUNCH.marketplaceUrl).toContain("marketplace/actions/policysemver");
  expect(LAUNCH.quickstartUnder15Minutes).toBe(true);
  expect(LAUNCH.consumersDependOnPublishedArtifacts).toBe(true);
  expect(LAUNCH.nonClaimChangesetsGraph).toBe(true);
  expect(LAUNCH.differentiators).toContain("feat & fix:");
  expect(LAUNCH.differentiators).toContain("ranked classifier fixtures");
});

it("community files, npm provenance, Action dist and Marketplace exist", () => {
  for (const rel of LAUNCH.communityFiles) {
    expect(existsSync(path.join(root, rel)), rel).toBe(true);
  }
  expect(existsSync(path.join(root, "packages/cli/LICENSE"))).toBe(true);
  expect(existsSync(path.join(root, "packages/core/LICENSE"))).toBe(true);
  expect(existsSync(path.join(root, "dist/index.js"))).toBe(true);
  expect(read("LICENSE")).toMatch(/MIT License/);
  const readme = read("README.md");
  expect(readme).toMatch(/Trusted publishing/);
  expect(readme).toMatch(/## GitHub Marketplace/);
  expect(readme).toContain(LAUNCH.marketplaceUrl);
  expect(readme).toMatch(/## Pin by SHA/);
  expect(readme).toContain(LAUNCH.pinBySha);
  expect(readme).toContain(LAUNCH.npmCli);
  expect(read("action.yml")).toMatch(/main:\s*dist\/index\.js/);
  expect(read(".github/workflows/policy-semver.yml")).toMatch(
    /uses:\s*\.\/packages\/action/,
  );
});

it("README announces differentiators and the Changesets non-claim", () => {
  const readme = read("README.md");
  expect(readme).toMatch(/under 15 minutes/);
  expect(readme).toMatch(/major via env/i);
  expect(readme).toMatch(/feat & fix:/);
  expect(readme).toMatch(/sync prod→dev without a bump/i);
  expect(readme).toMatch(/ranked classifier fixtures/i);
  expect(readme).toMatch(
    /does not claim to be better than Changesets for monorepos/,
  );
  expect(readme).not.toMatch(/IMPLEMENTATION-PLAN/);
  expect(readme).not.toMatch(/VE-STATUS/);
});

it("consumers depend on published artifacts, not vendored packages/", () => {
  const examples = read("examples/README.md");
  expect(examples).toMatch(/Do not import `@policy-semver\/core`/);
  expect(examples).toMatch(/Do not copy `packages\/core`/);
  expect(examples).toMatch(/npx policy-semver@1\.0\.0/);
  expect(read("pnpm-workspace.yaml")).not.toMatch(/^\s+-\s+"examples/m);
  for (const dir of ["examples/node-app", "examples/cloudflare-worker"]) {
    expect(read(`${dir}/package.json`)).not.toMatch(/"file:/);
  }
});

it("CONTRIBUTING documents the launch gate", () => {
  const contributing = read("CONTRIBUTING.md");
  expect(contributing).toMatch(/## Launch/);
  expect(contributing).toMatch(/under 15 minutes/);
  expect(contributing).toMatch(/LICENSE/);
  expect(contributing).toMatch(/SECURITY\.md/);
  expect(contributing).toMatch(/CODE_OF_CONDUCT/);
  expect(contributing).not.toMatch(/IMPLEMENTATION-PLAN/);
  expect(contributing).not.toMatch(/\]\(\.\/docs\//);
});
