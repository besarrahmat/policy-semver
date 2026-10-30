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
