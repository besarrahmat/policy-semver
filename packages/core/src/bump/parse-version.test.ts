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

describe("parseSemVer edges", () => {
  it("reads several digits in every part", () => {
    expect(parseSemVer("12.34.56")).toEqual({
      major: 12,
      minor: 34,
      patch: 56,
    });
  });

  it.each(["1a.0.0", "1.2a.0", "1.0.2a"])("%s is malformed", (version) => {
    expect(() => parseSemVer(version)).toThrow(/malformed version/);
  });

  it("says when a number is out of range", () => {
    expect(() => parseSemVer("9007199254740993.0.0")).toThrow(/out of range/);
  });

  it("isSemVerString tolerates the newline a VERSION file ends with", () => {
    expect(isSemVerString("1.2.3\n")).toBe(true);
  });
});
