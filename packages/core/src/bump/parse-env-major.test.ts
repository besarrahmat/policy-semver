import { expect, it } from "vitest";
import { parseEnvMajor } from "./parse-env-major.js";

it("treats unset and empty as no major", () => {
  expect(parseEnvMajor("M", undefined)).toBeNull();
  expect(parseEnvMajor("M", "")).toBeNull();
});

it("reads digits", () => {
  expect(parseEnvMajor("M", "2")).toBe(2);
});

it.each(["2abc", "abc", "-1", "1.5", " 2"])("rejects %j", (raw) => {
  expect(() => parseEnvMajor("M", raw)).toThrow(/invalid M=/);
});
