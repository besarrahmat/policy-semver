import { existsSync, readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import {
  REQUIRED_CLASSIFIER_FIXTURES,
  TESTING_CI,
  TESTING_LAYERS,
} from "./testing-locks.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

it("CI runs unit and golden layers on PRs to dev", () => {
  const ci = read(TESTING_CI.workflow);
  expect(ci).toMatch(/pull_request:/);
  expect(ci).toMatch(/branches:\s*\[dev, main\]/);
  expect(ci).toContain(`run: ${TESTING_CI.unitCommand}`);
  expect(ci).toContain(`run: ${TESTING_CI.goldenCommand}`);
});

it("each testing layer still has proof on disk", () => {
  for (const rel of [
    ...TESTING_LAYERS.unit.files,
    ...TESTING_LAYERS.integration.files,
    ...TESTING_LAYERS.actionSmoke.files,
    TESTING_LAYERS.dogfood.workflow,
  ]) {
    expect(existsSync(path.join(root, rel)), rel).toBe(true);
  }
  const dogfood = read(TESTING_LAYERS.dogfood.workflow);
  expect(dogfood).toMatch(/branches:\s*\[main\]/);
  expect(dogfood).toMatch(/uses:\s*\.\/packages\/action/);
});

it("does not allow deleting required golden fixtures", async () => {
  const dir = path.join(root, TESTING_LAYERS.golden.dir);
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
  expect(names.length).toBeGreaterThanOrEqual(
    REQUIRED_CLASSIFIER_FIXTURES.length,
  );
  for (const file of REQUIRED_CLASSIFIER_FIXTURES) {
    expect(names).toContain(file);
    expect(existsSync(path.join(dir, file))).toBe(true);
  }
});

it("CONTRIBUTING and fixtures README tell contributors not to drop goldens", () => {
  const contributing = read("CONTRIBUTING.md");
  expect(contributing).toMatch(/## Testing/);
  expect(contributing).toMatch(/every PR to `dev`/);
  expect(contributing).toMatch(/Do not delete/);
  expect(contributing).toMatch(/fixtures\/classifier/);
  expect(contributing).not.toMatch(/IMPLEMENTATION-PLAN/);
  const fixturesReadme = read("fixtures/README.md");
  expect(fixturesReadme).toMatch(/Do \*\*not\*\* delete/);
});
