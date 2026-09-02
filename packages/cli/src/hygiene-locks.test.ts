import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { REPO_HYGIENE, SCHEMA_VERSION_CURRENT } from "./hygiene-locks.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

it("locks standing repo hygiene flags", () => {
  expect(REPO_HYGIENE.conventionalCommitsOnDev).toBe(true);
  expect(REPO_HYGIENE.commitActionDist).toBe(true);
  expect(REPO_HYGIENE.schemaVersionBumpDocumented).toBe(true);
  expect(REPO_HYGIENE.secondConsumerOnPublishedArtifacts).toBe(true);
  expect(REPO_HYGIENE.reverifyTrustedPublishAndNode24).toBe(true);
  expect(REPO_HYGIENE.blockersFile).toBe("BLOCKERS.md");
  expect(SCHEMA_VERSION_CURRENT).toBe("1");
});

it("CONTRIBUTING documents hygiene without the local plan folder", () => {
  const contributing = read("CONTRIBUTING.md");
  expect(contributing).toMatch(/## Repo hygiene/);
  expect(contributing).toMatch(/Conventional Commits/);
  expect(contributing).toMatch(/`dev`/);
  expect(contributing).toMatch(/dist\//);
  expect(contributing).toMatch(/schemaVersion/);
  expect(contributing).toMatch(/examples\//);
  expect(contributing).toMatch(/Trusted publishing/);
  expect(contributing).toMatch(/node24/);
  expect(contributing).toMatch(/BLOCKERS\.md/);
  expect(contributing).not.toMatch(/IMPLEMENTATION-PLAN/);
  expect(contributing).not.toMatch(/VE-STATUS/);
  expect(contributing).not.toMatch(/\]\(\.\/docs\//);
});

it("CI rebuilds Action dist and fails if it drifted", () => {
  const ci = read(".github/workflows/ci.yml");
  expect(ci).toMatch(/Action dist up to date/);
  expect(ci).toMatch(/@policy-semver\/action run build/);
  expect(ci).toMatch(/git diff --exit-code dist\//);
  expect(read("action.yml")).toMatch(/using:\s*node24/);
  expect(read(".node-version").trim()).toBe("24");
});

it("schemaVersion is 1 until a documented breaking bump", () => {
  const schema = JSON.parse(read("schemas/versioning.config.schema.json")) as {
    properties?: { schemaVersion?: { const?: string } };
  };
  expect(schema.properties?.schemaVersion?.const).toBe(SCHEMA_VERSION_CURRENT);
  expect(read("packages/core/src/config/types.ts")).toMatch(
    /schemaVersion:\s*"1"/,
  );
  expect(read("CONTRIBUTING.md")).toMatch(
    /Breaking config changes bump `schemaVersion`/,
  );
});

it("second consumer examples pin published 0.1.0 and SHA", () => {
  const examples = read("examples/README.md");
  expect(examples).toMatch(/A second consumer app/);
  expect(examples).toMatch(/npx policy-semver@0\.1\.0/);
  expect(examples).toMatch(
    /uses: besarrahmat\/policy-semver@<full-commit-sha>/,
  );
});

it("release notes stay on Trusted Publishing and node24", () => {
  expect(read("README.md")).toMatch(/Trusted publishing/);
  expect(read("README.md")).toMatch(/node24|Node \*\*24\+/);
  expect(read("packages/cli/src/publish-locks.ts")).toMatch(
    /docsTrustedPublishers/,
  );
  expect(read("packages/action/src/locks.ts")).toMatch(/node24/);
});

it("tracked BLOCKERS.md exists with the public table", () => {
  expect(existsSync(path.join(root, REPO_HYGIENE.blockersFile))).toBe(true);
  const blockers = read(REPO_HYGIENE.blockersFile);
  expect(blockers).toMatch(/# Blockers/);
  expect(blockers).toMatch(
    /\| Date\s+\| Area\s+\| Issue\s+\| Owner\s+\| Status\s+\| Resolution\s+\|/,
  );
  expect(blockers).toMatch(/esbuild/);
});
