import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadConfig } from "./load-config.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../../",
);

function fixture(...parts: string[]): string {
  return path.join(repoRoot, "fixtures", "config", ...parts);
}

describe("loadConfig", () => {
  it("loads minimal config and applies defaults", async () => {
    const config = await loadConfig(fixture("valid", "minimal.json"));

    expect(config.schemaVersion).toBe("1");
    expect(config.prodBranch).toBe("main");
    expect(config.developBranch).toBe("dev");
    expect(config.majorEnv).toBe("APP_VERSION_MAJOR");
    expect(config.versionFiles).toEqual(["VERSION", "package.json"]);
    expect(config.changelogPath).toBe("CHANGELOG.md");
    expect(config.tagPrefix).toBe("v");
    expect(config.skipLabels).toEqual(["skip-version"]);
    expect(config.skipTrailers).toEqual(["skip version"]);
    expect(config.hooks).toEqual({
      beforeBump: null,
      afterTag: null,
      afterRelease: null,
    });
  });

  it("loads full fixture config", async () => {
    const config = await loadConfig(fixture("valid", "full.json"));

    expect(config).toEqual({
      schemaVersion: "1",
      prodBranch: "main",
      developBranch: "dev",
      majorEnv: "APP_VERSION_MAJOR",
      versionFiles: ["VERSION", "package.json"],
      changelogPath: "CHANGELOG.md",
      tagPrefix: "v",
      skipLabels: ["skip-version"],
      skipTrailers: ["skip version"],
      hooks: {
        beforeBump: null,
        afterTag: null,
        afterRelease: null,
      },
    });
  });

  it("fails when schemaVersion is missing", async () => {
    await expect(
      loadConfig(fixture("invalid", "missing-schema-version.json")),
    ).rejects.toThrow(/invalid versioning config/i);
  });

  it("fails on unknown keys", async () => {
    await expect(
      loadConfig(fixture("invalid", "unknown-key.json")),
    ).rejects.toThrow(/additional properties/i);
  });

  it("fails on wrong types", async () => {
    await expect(
      loadConfig(fixture("invalid", "wrong-type.json")),
    ).rejects.toThrow(/invalid versioning config/i);
  });

  it("fails on empty object", async () => {
    await expect(loadConfig(fixture("invalid", "empty.json"))).rejects.toThrow(
      /invalid versioning config/i,
    );
  });

  it("fails when file is missing", async () => {
    await expect(
      loadConfig(fixture("valid", "does-not-exist.json")),
    ).rejects.toThrow(/not found/i);
  });

  it("loads hook command strings", async () => {
    const config = await loadConfig(fixture("valid", "hooks-commands.json"));
    expect(config.hooks).toEqual({
      beforeBump: "pnpm run preversion",
      afterTag: null,
      afterRelease: "echo released",
    });
  });

  it("fails on unknown hook key", async () => {
    await expect(
      loadConfig(fixture("invalid", "unknown-hook.json")),
    ).rejects.toThrow(/additional properties/i);
  });
});
