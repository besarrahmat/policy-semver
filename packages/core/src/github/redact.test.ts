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

it.each([
  ["ghs_", `ghs_${"a".repeat(36)}`],
  ["ghu_", `ghu_${"a".repeat(36)}`],
  ["ghr_", `ghr_${"a".repeat(36)}`],
  ["github_pat_", `github_pat_${"a".repeat(40)}`],
  ["xoxb-", `xoxb-${"1".repeat(20)}`],
  ["ASIA", `ASIA${"IOSFODNN7EXAMPLE"}`],
  ["sk-ant-", `sk-ant-${"a".repeat(30)}`],
  ["JWT", `eyJ${"a".repeat(10)}.${"b".repeat(10)}.${"c".repeat(10)}`],
])("redacts %s", (_name, secret) => {
  expect(redactSecrets(`value ${secret} end`)).toBe("value [REDACTED] end");
});

it("redacts a whole Bearer token, including base64 characters", () => {
  expect(redactSecrets("Bearer abc/def+ghi==")).toBe("[REDACTED]");
});

it("redacts a Basic auth header but keeps prose", () => {
  expect(redactSecrets("Authorization: Basic dXNlcjpwYXNz")).toBe("[REDACTED]");
  expect(redactSecrets("Basic authentication added")).toBe(
    "Basic authentication added",
  );
});

it("redacts credentials in a remote URL", () => {
  expect(
    redactSecrets("fatal: https://x-access-token:abc123@github.com/o/r.git"),
  ).toBe("fatal: https://[REDACTED]@github.com/o/r.git");
});
