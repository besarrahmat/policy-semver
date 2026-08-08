import { describe, expect, it } from "vitest";
import { formatSemVer, isSemVerString, parseSemVer } from "./parse-version.js";

describe("parseSemVer", () => {
  it("parses X.Y.Z", () => {
    expect(parseSemVer("1.4.2")).toEqual({
      major: 1,
      minor: 4,
      patch: 2,
    });
    expect(parseSemVer(" 0.0.0 ")).toEqual({
      major: 0,
      minor: 0,
      patch: 0,
    });
  });

  it("rejects malformed versions", () => {
    expect(() => parseSemVer("1.2")).toThrow(/malformed version/i);
    expect(() => parseSemVer("1.2.3-beta")).toThrow(/malformed version/i);
    expect(() => parseSemVer("v1.2.3")).toThrow(/malformed version/i);
    expect(() => parseSemVer("")).toThrow(/malformed version/i);
  });

  it("isSemVerString / formatSemVer round-trip", () => {
    expect(isSemVerString("1.2.3")).toBe(true);
    expect(isSemVerString("1.2")).toBe(false);
    expect(formatSemVer({ major: 2, minor: 0, patch: 0 })).toBe("2.0.0");
  });
});
