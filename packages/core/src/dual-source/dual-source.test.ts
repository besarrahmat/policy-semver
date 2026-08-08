import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyBump } from "../bump/apply-bump.js";
import { readVersion } from "../bump/read-version.js";
import { writeVersion } from "../bump/write-version.js";
import {
  assertDualSourceMatch,
  readBothConfigured,
  writeBothAtomically,
} from "./index.js";

async function makeTempCwd(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "policy-semver-dual-"));
}

describe("dual-source module", () => {
  const both = { versionFile: "VERSION", packageJson: "package.json" };

  it("assertDualSourceMatch throws on mismatch", () => {
    expect(() => assertDualSourceMatch("1.0.0", "2.0.0")).toThrow(
      /dual-source mismatch/,
    );
  });

  it("match OK → readBothConfigured / readVersion", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");
    await writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "app", version: "1.0.0" }, null, 2)}\n`,
    );
    await expect(
      readBothConfigured(cwd, "VERSION", "package.json"),
    ).resolves.toBe("1.0.0");
    await expect(readVersion({ cwd, files: both })).resolves.toBe("1.0.0");
  });

  it("mismatch → fail (no pick one)", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");
    await writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "app", version: "2.0.0" }, null, 2)}\n`,
    );
    await expect(
      readBothConfigured(cwd, "VERSION", "package.json"),
    ).rejects.toThrow(/dual-source mismatch/);
    await expect(readVersion({ cwd, files: both })).rejects.toThrow(
      /dual-source mismatch/,
    );
  });

  it("atomic success updates both (writeBothAtomically + writeVersion)", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");
    await writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "app", version: "1.0.0" }, null, 2)}\n`,
    );

    await writeBothAtomically({
      cwd,
      versionFile: "VERSION",
      packageJson: "package.json",
      nextVersion: "1.0.1",
    });
    expect((await readFile(path.join(cwd, "VERSION"), "utf8")).trim()).toBe(
      "1.0.1",
    );

    const next = applyBump({ kind: "minor", currentVersion: "1.0.1" });
    const result = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: true,
      files: both,
    });

    expect(result.wrote).toBe(true);
    expect((await readFile(path.join(cwd, "VERSION"), "utf8")).trim()).toBe(
      "1.1.0",
    );
    const pkg = JSON.parse(
      await readFile(path.join(cwd, "package.json"), "utf8"),
    ) as { version: string };
    expect(pkg.version).toBe("1.1.0");
  });

  it("atomic rollback restores both when second write fails", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");
    await writeFile(path.join(cwd, "package.json"), "NOT-JSON\n");

    await expect(
      writeBothAtomically({
        cwd,
        versionFile: "VERSION",
        packageJson: "package.json",
        nextVersion: "1.0.1",
      }),
    ).rejects.toThrow();

    expect((await readFile(path.join(cwd, "VERSION"), "utf8")).trim()).toBe(
      "1.0.0",
    );
    expect(await readFile(path.join(cwd, "package.json"), "utf8")).toBe(
      "NOT-JSON\n",
    );
  });

  it("both paths configured but only VERSION on disk → single-source write", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");

    const result = await writeVersion({
      cwd,
      nextVersion: "1.1.0",
      dryRun: false,
      allowWrite: true,
      files: both,
    });

    expect(result.wrote).toBe(true);
    expect((await readFile(path.join(cwd, "VERSION"), "utf8")).trim()).toBe(
      "1.1.0",
    );
  });
});
