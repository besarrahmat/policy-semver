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
  expect(NPM_OPERATOR.expect404UntilFirstPublish).toBe(false);
  expect(NPM_OPERATOR.firstPublicVersionPublishedWithoutOidcProvenance).toBe(
    true,
  );
  expect(NPM_OPERATOR.nextOidcPublishVersion).toBe("0.1.1");
});

it("publisher Node pin and package names match the repo", () => {
  expect(readFileSync(path.join(root, ".node-version"), "utf8").trim()).toBe(
    "24",
  );
  const rootPkg = readJson("package.json");
  expect(rootPkg.name).toBe("policy-semver-monorepo");
  expect(rootPkg.private).toBe(true);
  const cli = readJson("packages/cli/package.json");
  const core = readJson("packages/core/package.json");
  expect(cli.name).toBe("policy-semver");
  expect(cli.version).toBe("0.1.0");
  expect(cli.private).toBeUndefined();
  expect(core.name).toBe("@policy-semver/core");
  expect(core.version).toBe("0.1.0");
  expect(core.private).toBeUndefined();
  expect(readJson("packages/action/package.json").private).toBe(true);
  const cliPub = cli.publishConfig as { access?: string; provenance?: boolean };
  const corePub = core.publishConfig as {
    access?: string;
    provenance?: boolean;
  };
  expect(cliPub.access).toBe("public");
  expect(cliPub.provenance).toBe(true);
  expect(corePub.access).toBe("public");
  expect(corePub.provenance).toBe(true);
});

it("publish.yml is OIDC tag-only; CI builds before tests", () => {
  const publish = readFileSync(
    path.join(root, ".github/workflows/publish.yml"),
    "utf8",
  );
  expect(publish).toMatch(/tags:\s*\["v0\.\*", "v1\.\*"\]/);
  expect(publish).toMatch(/id-token: write/);
  expect(publish).toMatch(/github\.repository == 'besarrahmat\/policy-semver'/);
  expect(publish).toMatch(/--filter '@policy-semver\/core' publish/);
  expect(publish).toMatch(/--filter policy-semver publish/);
  expect(publish).toMatch(/run: pnpm build/);
  expect(publish).not.toMatch(/^\s+registry-url:/m);
  expect(publish).not.toMatch(/secrets\.(NPM_TOKEN|NODE_AUTH_TOKEN)/);
  expect(publish).not.toMatch(/branches:\s*\[/);
  const ci = readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  expect(ci).toMatch(/run: pnpm build/);
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
