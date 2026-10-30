import { expect, it } from "vitest";
import { decideBumpGuards } from "./guards.js";

const ctx = {
  isFork: false,
  baseBranch: "main",
  headBranch: "feature",
  prodBranch: "main",
  developBranch: "dev",
};

it.each([
  "chore(release): v1.0.0 [skip version]",
  "body line\n[skip version]\nmore",
])("honours a skip marker ending a line: %j", (text) => {
  expect(decideBumpGuards({ ...ctx, textsForSkip: [text] }).forceKindNone).toBe(
    true,
  );
});

it("ignores prose that merely mentions the marker", () => {
  const decision = decideBumpGuards({
    ...ctx,
    textsForSkip: ["docs mention [skip version] syntax"],
  });
  expect(decision.forceKindNone).toBe(false);
});
