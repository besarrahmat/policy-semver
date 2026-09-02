import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const readme = readFileSync(path.join(root, "README.md"), "utf8");
const contributing = readFileSync(path.join(root, "CONTRIBUTING.md"), "utf8");

it("README quickstart is Action dry-run under 15 minutes", () => {
  expect(readme).toMatch(/## Quickstart/);
  expect(readme).toMatch(/under 15 minutes/);
  expect(readme).toMatch(/PolicySemVer \(dry-run\)/);
  expect(readme).toMatch(/uses: besarrahmat\/policy-semver@<full-commit-sha>/);
  expect(readme).toMatch(/npx policy-semver@1\.0\.0 classify --help/);
});

it("README does not claim Changesets monorepo superiority", () => {
  expect(readme).toMatch(
    /does not claim to be better than Changesets for monorepos/,
  );
  expect(readme).toMatch(/examples\/migrate-from-changesets\.md/);
  expect(readme).toMatch(/Option B/);
  expect(readme).not.toMatch(/skip-if-no-match/);
});

it("README does not point at the local gitignored plan folder", () => {
  expect(readme).not.toMatch(/\]\(\.\/docs\//);
  expect(readme).not.toMatch(/IMPLEMENTATION-PLAN/);
  expect(readme).not.toMatch(/STEP-BY-STEP-CHECKLIST/);
  expect(readme).not.toMatch(/VE-STATUS/);
  expect(contributing).not.toMatch(/IMPLEMENTATION-PLAN/);
  expect(contributing).not.toMatch(/VE-STATUS/);
});

it("CONTRIBUTING ships the commit cheat sheet", () => {
  expect(contributing).toMatch(/## Commit cheat sheet/);
  expect(contributing).toMatch(/`feat:` \/ `feat\(scope\):` \/ `feat & fix:`/);
  expect(contributing).toMatch(/`docs:` only/);
  expect(contributing).toMatch(/major env raised/);
  expect(contributing).toMatch(/`\[skip version\]` \/ label/);
});
