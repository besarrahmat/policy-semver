import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertExtraPackageJsonMatch,
  extrasNeedWrite,
  readPrimaryVersion,
} from "./read-version.js";
import { writeVersion } from "./write-version.js";

async function repo(files: Record<string, string> = {}): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "ps-version-files-"));
  for (const [rel, content] of Object.entries(files)) {
    await mkdir(path.dirname(path.join(cwd, rel)), { recursive: true });
    await writeFile(path.join(cwd, rel), content);
  }
  return cwd;
}

const pkg = (version: string) => `${JSON.stringify({ version })}\n`;
const version = async (cwd: string, rel: string) =>
  JSON.parse(await readFile(path.join(cwd, rel), "utf8")).version;

describe("readPrimaryVersion", () => {
  it("reads a VERSION-only or package.json-only repo", async () => {
    const cwd = await repo({
      VERSION: "1.2.3\n",
      "package.json": pkg("4.5.6"),
    });
    expect(
      await readPrimaryVersion({ cwd, files: { versionFile: "VERSION" } }),
    ).toBe("1.2.3");
    expect(
      await readPrimaryVersion({ cwd, files: { packageJson: "package.json" } }),
    ).toBe("4.5.6");
  });

  it.each([
    [{ versionFile: "VERSION" }, /VERSION not found/],
    [{ packageJson: "package.json" }, /package\.json not found/],
    [{}, /no versionFiles configured/],
  ])("names what is missing: %j", async (files, message) => {
    const cwd = await repo();
    await expect(readPrimaryVersion({ cwd, files })).rejects.toThrow(message);
  });
});

describe("extra package.json files", () => {
  it("a missing one fails closed, by name", async () => {
    const cwd = await repo();
    await expect(
      assertExtraPackageJsonMatch(cwd, ["sub/package.json"], "1.0.0"),
    ).rejects.toThrow(/package\.json not found/);
  });

  it("only stale ones need a write", async () => {
    const cwd = await repo({
      "a/package.json": pkg("1.0.0"),
      "b/package.json": pkg("2.0.0"),
    });
    expect(await extrasNeedWrite(cwd, undefined, "1.0.0")).toBe(false);
    expect(await extrasNeedWrite(cwd, ["a/package.json"], "1.0.0")).toBe(false);
    expect(await extrasNeedWrite(cwd, ["a/package.json"], "2.0.0")).toBe(true);
    expect(
      await extrasNeedWrite(cwd, ["a/package.json", "b/package.json"], "1.0.0"),
    ).toBe(true);
  });
});

describe("writeVersion", () => {
  const write = (
    cwd: string,
    files: Parameters<typeof writeVersion>[0]["files"],
    nextVersion = "1.1.0",
  ) =>
    writeVersion({ cwd, nextVersion, dryRun: false, allowWrite: true, files });

  it("creates a VERSION file that does not exist yet", async () => {
    const cwd = await repo();
    expect(await write(cwd, { versionFile: "VERSION" })).toEqual({
      nextVersion: "1.1.0",
      wrote: true,
      reason: "written",
    });
    expect((await readFile(path.join(cwd, "VERSION"), "utf8")).trim()).toBe(
      "1.1.0",
    );
  });

  it("does not hide a VERSION it cannot read", async () => {
    const cwd = await repo({ "VERSION/file": "x" });
    await expect(write(cwd, { versionFile: "VERSION" })).rejects.toThrow(
      /EISDIR/,
    );
  });

  it("package.json only: writes, then reports already current", async () => {
    const cwd = await repo({ "package.json": pkg("1.0.0") });
    const files = { packageJson: "package.json" };
    expect(await write(cwd, files)).toMatchObject({
      wrote: true,
      reason: "written",
    });
    expect(await version(cwd, "package.json")).toBe("1.1.0");
    expect(await write(cwd, files)).toEqual({
      nextVersion: "1.1.0",
      wrote: false,
      reason: "already-current",
    });
  });

  it("package.json already current still writes stale extras", async () => {
    const cwd = await repo({
      "package.json": pkg("1.1.0"),
      "sub/package.json": pkg("1.0.0"),
    });
    expect(
      await write(cwd, {
        packageJson: "package.json",
        extraPackageJson: ["sub/package.json"],
      }),
    ).toMatchObject({ wrote: true });
    expect(await version(cwd, "sub/package.json")).toBe("1.1.0");
  });

  const both = { versionFile: "VERSION", packageJson: "package.json" };

  it("both files already current: nothing to write", async () => {
    const cwd = await repo({
      VERSION: "1.1.0\n",
      "package.json": pkg("1.1.0"),
    });
    expect(await write(cwd, both)).toEqual({
      nextVersion: "1.1.0",
      wrote: false,
      reason: "already-current",
    });
  });

  it("both files behind: writes both", async () => {
    const cwd = await repo({
      VERSION: "1.0.0\n",
      "package.json": pkg("1.0.0"),
    });
    expect(await write(cwd, both)).toEqual({
      nextVersion: "1.1.0",
      wrote: true,
      reason: "written",
    });
    expect(await version(cwd, "package.json")).toBe("1.1.0");
  });

  it("both configured, only package.json on disk: writes that one", async () => {
    const cwd = await repo({ "package.json": pkg("1.0.0") });
    expect(await write(cwd, both)).toMatchObject({
      wrote: true,
      reason: "written",
    });
    expect(await version(cwd, "package.json")).toBe("1.1.0");
    await expect(readFile(path.join(cwd, "VERSION"))).rejects.toThrow();
  });

  it("both configured, neither on disk: fails", async () => {
    await expect(write(await repo(), both)).rejects.toThrow(
      /neither VERSION nor package\.json/,
    );
  });

  it("nothing configured: fails", async () => {
    await expect(write(await repo(), {})).rejects.toThrow(
      /no versionFiles configured/,
    );
  });
});
