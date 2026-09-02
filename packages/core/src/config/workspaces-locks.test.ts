import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { WORKSPACES_V1 } from "./workspaces-locks.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

it("locks Option B: omit workspaces, no graph parity, deferred to 0.2", () => {
  expect(WORKSPACES_V1.option).toBe("B");
  expect(WORKSPACES_V1.deferredTo).toBe("0.2");
  expect(WORKSPACES_V1.schemaKeyOmitted).toBe(true);
  expect(WORKSPACES_V1.acceptNullPlaceholder).toBe(false);
  expect(WORKSPACES_V1.pathFilterMvp).toBe(false);
  expect(WORKSPACES_V1.packageGraphParity).toBe(false);
  expect(WORKSPACES_V1.pathFilterFalseNegativesNotAv1Bug).toBe(true);
});

it("canonical and embed schemas omit the workspaces key", () => {
  for (const rel of [
    "schemas/versioning.config.schema.json",
    "packages/core/src/config/versioning.config.schema.json",
  ]) {
    const schema = JSON.parse(read(rel)) as {
      properties?: Record<string, unknown>;
    };
    expect(schema.properties).toBeDefined();
    expect(schema.properties).not.toHaveProperty("workspaces");
  }
});

it("README documents Option B and does not claim Changesets graph parity", () => {
  const readme = read("README.md");
  expect(readme).toMatch(/Option B/);
  expect(readme).toMatch(/Omit.*`workspaces`/i);
  expect(readme).toMatch(/fail-closed/);
  expect(readme).toMatch(
    /does not claim to be better than Changesets for monorepos/,
  );
  expect(readme).not.toMatch(/skip-if-no-match/);
});
