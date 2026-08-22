import { expect, it } from "vitest";
import { writeFailureMessage } from "./write-failure.js";

it("push-denied includes PAT/App hint", () => {
  const msg = writeFailureMessage(new Error("protected branch hook declined"));
  expect(msg).toMatch(/Write\/push\/release failed:/);
  expect(msg).toMatch(/POLICY_SEMVER_TOKEN/);
});

it("other errors have no bypass hint", () => {
  expect(writeFailureMessage(new Error("disk full"))).not.toMatch(
    /POLICY_SEMVER_TOKEN/,
  );
});
