import { expect, it } from "vitest";
import { writeFailureMessage } from "./write-failure.js";

it("push-denied points at the checkout credentials", () => {
  const msg = writeFailureMessage(new Error("protected branch hook declined"));
  expect(msg).toMatch(/Write\/push\/release failed:/);
  expect(msg).toMatch(/actions\/checkout/);
});

it("other errors have no bypass hint", () => {
  expect(writeFailureMessage(new Error("disk full"))).not.toMatch(
    /actions\/checkout/,
  );
});

it("says a rerun is safe", () => {
  expect(writeFailureMessage(new Error("disk full"))).toMatch(/Rerunning/);
});

it("redacts secrets from the message", () => {
  const msg = writeFailureMessage(
    new Error("push https://x:abc123@github.com/o/r.git"),
  );
  expect(msg).not.toContain("abc123");
});

it.each([
  "tag already exists: v1.1.0",
  "mirror tag conflict: v1.1.0 remote=a local HEAD=b",
  "CHANGELOG conflict markers in CHANGELOG.md",
  "version 5.0.0 is a higher major than the latest tags (1.x)",
  "commit: The following paths are ignored by one of your .gitignore files",
  "tag v1.1.0 points at a, not release commit b",
  "CHANGELOG.md at a has no section for 1.1.0",
  "tag v1.1.0 is missing on the remote",
])("does not promise a rerun for %j", (text) => {
  const msg = writeFailureMessage(new Error(text));
  expect(msg).not.toMatch(/Rerunning/);
  expect(msg).toMatch(/rerun fails the same way/);
});
