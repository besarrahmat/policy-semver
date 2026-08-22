import { expect, it } from "vitest";
import { redactSecrets } from "./redact.js";

it("redacts ghp_/gho_/npm_/AKIA/Bearer", () => {
  const pad = "abcdefghijklmnopqrstuvwxyz12";
  const fake = [
    `token ghp_${pad}`,
    `gho_${pad}`,
    `npm_${pad}`,
    `AKIA${"IOSFODNN7EXAMPLE"}`,
    `Authorization: Bearer ${"test_redact_token_xyz"}`,
  ].join("\n");
  const out = redactSecrets(fake);
  expect(out).not.toMatch(/ghp_/);
  expect(out).not.toMatch(/gho_/);
  expect(out).not.toMatch(/npm_/);
  expect(out).not.toMatch(/AKIA/);
  expect(out).not.toMatch(/Bearer\s+\S+/i);
  expect(out).toContain("[REDACTED]");
});
