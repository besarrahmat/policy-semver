import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  NPM_OPERATOR,
  NPM_PACKAGES,
  NPM_PROVENANCE,
  NPM_TRUSTED_PUBLISH,
} from "./publish-locks.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path.join(root, rel), "utf8")) as Record<
    string,
    unknown
  >;
}

it("locks first public 0.1.0, two public packages, OIDC provenance", () => {
  expect(NPM_PACKAGES.firstPublicVersion).toBe("0.1.0");
  expect(NPM_PACKAGES.access).toBe("public");
  expect(NPM_PACKAGES.publishOrder).toEqual([
    "@policy-semver/core",
    "policy-semver",
  ]);
  expect(NPM_PACKAGES.cli.name).toBe("policy-semver");
  expect(NPM_PACKAGES.core.name).toBe("@policy-semver/core");
  expect(NPM_PACKAGES.neverPublish).toContain("@policy-semver/action");
  expect(NPM_PACKAGES.versionsImmutable).toBe(true);
  expect(NPM_PROVENANCE.requiresPublicGitHubRepo).toBe(true);
  expect(NPM_PROVENANCE.privateSourceRepoCannotAttest).toBe(true);
  expect(NPM_TRUSTED_PUBLISH.minNpmCli).toBe("11.5.1");
  expect(NPM_TRUSTED_PUBLISH.nodeOnPublisher).toBe("24");
  expect(NPM_TRUSTED_PUBLISH.workflowFilename).toBe("publish.yml");
  expect(NPM_TRUSTED_PUBLISH.omitSetupNodeRegistryUrl).toBe(true);
  expect(NPM_TRUSTED_PUBLISH.githubOwner).toBe("besarrahmat");
  expect(NPM_TRUSTED_PUBLISH.githubRepo).toBe("policy-semver");
  expect(NPM_OPERATOR.twoFactorRequired).toBe(true);
  expect(NPM_OPERATOR.scopeOrg).toBe("@policy-semver");
});

it("publisher Node pin and package names match the repo", () => {
  expect(readFileSync(path.join(root, ".node-version"), "utf8").trim()).toBe(
    "24",
  );
  const rootPkg = readJson("package.json");
  expect(rootPkg.name).toBe("policy-semver-monorepo");
  expect(rootPkg.private).toBe(true);
  expect(readJson("packages/cli/package.json").name).toBe("policy-semver");
  expect(readJson("packages/core/package.json").name).toBe(
    "@policy-semver/core",
  );
  expect(readJson("packages/action/package.json").private).toBe(true);
});

it("root README documents provenance, public repo, and immutability", () => {
  const readme = readFileSync(path.join(root, "README.md"), "utf8");
  expect(readme).toMatch(/Trusted publishing/);
  expect(readme).toMatch(/id-token: write/);
  expect(readme).toMatch(/public GitHub repo/);
  expect(readme).toMatch(/immutable/);
  expect(readme).toMatch(/0\.1\.1/);
  expect(readme).not.toMatch(/IMPLEMENTATION-PLAN/);
});
