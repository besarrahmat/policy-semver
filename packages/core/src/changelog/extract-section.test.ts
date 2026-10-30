import { describe, expect, it } from "vitest";
import { extractReleaseSection } from "./extract-section.js";

const changelog = `# Changelog

## [Unreleased]

## [1.1.0] - 2026-01-02

### Added

- new thing

## [1.0.0] - 2026-01-01

### Fixed

- old thing
`;

describe("extractReleaseSection", () => {
  it("stops at the next release heading", () => {
    expect(extractReleaseSection(changelog, "1.1.0")).toBe(
      "## [1.1.0] - 2026-01-02\n\n### Added\n\n- new thing\n",
    );
  });

  it("reads the last section to the end of the file", () => {
    expect(extractReleaseSection(changelog, "1.0.0")).toBe(
      "## [1.0.0] - 2026-01-01\n\n### Fixed\n\n- old thing\n",
    );
  });

  it("does not match a longer version with the same prefix", () => {
    expect(extractReleaseSection("## [1.1.00]\n", "1.1.0")).toBe("");
  });

  it("returns an empty string when the version is absent", () => {
    expect(extractReleaseSection(changelog, "9.9.9")).toBe("");
  });
});
