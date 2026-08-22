import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applyBump } from "./apply-bump.js";
import { decideBumpGuards } from "./guards.js";
import { writeVersion } from "./write-version.js";

async function makeTempCwd(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "policy-semver-bump-"));
}

async function readVersionFile(cwd: string, name = "VERSION"): Promise<string> {
  return (await readFile(path.join(cwd, name), "utf8")).trim();
}

describe("bump write integration", () => {
  it("writes VERSION and package.json content", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");
    await writeFile(
      path.join(cwd, "package.json"),
      `${JSON.stringify({ name: "app", version: "1.0.0" }, null, 2)}\n`,
    );

    const next = applyBump({ kind: "minor", currentVersion: "1.0.0" });
    expect(next).toBe("1.1.0");

    const vResult = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: true,
      files: { versionFile: "VERSION" },
    });
    expect(vResult.wrote).toBe(true);
    expect(await readVersionFile(cwd)).toBe("1.1.0");

    const pkgResult = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: true,
      files: { packageJson: "package.json" },
    });
    expect(pkgResult.wrote).toBe(true);
    const pkg = JSON.parse(
      await readFile(path.join(cwd, "package.json"), "utf8"),
    ) as { version: string };
    expect(pkg.version).toBe("1.1.0");
  });

  it("dry-run leaves files untouched", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.2.3\n");

    const next = applyBump({ kind: "patch", currentVersion: "1.2.3" });
    const result = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: true,
      allowWrite: true,
      files: { versionFile: "VERSION" },
    });

    expect(result.wrote).toBe(false);
    expect(result.reason).toBe("dry-run");
    expect(await readVersionFile(cwd)).toBe("1.2.3");
  });

  it("allowWrite false never writes even for minor", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");

    const next = applyBump({ kind: "minor", currentVersion: "1.0.0" });
    expect(next).toBe("1.1.0");

    const result = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: false,
      files: { versionFile: "VERSION" },
    });

    expect(result.wrote).toBe(false);
    expect(result.reason).toBe("allow-write-false");
    expect(await readVersionFile(cwd)).toBe("1.0.0");
  });

  it("skip trailer forces none and no write", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");

    const guards = decideBumpGuards({
      isFork: false,
      baseBranch: "main",
      headBranch: "feat/x",
      prodBranch: "main",
      developBranch: "dev",
      isMergedToProd: true,
      textsForSkip: ["feat: add thing [skip version]"],
    });

    expect(guards.forceKindNone).toBe(true);
    expect(guards.allowWrite).toBe(false);

    const kind = guards.forceKindNone ? "none" : "minor";
    const next = applyBump({ kind, currentVersion: "1.0.0" });
    expect(next).toBe("1.0.0");

    const result = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: guards.allowWrite,
      files: { versionFile: "VERSION" },
    });

    expect(result.wrote).toBe(false);
    expect(await readVersionFile(cwd)).toBe("1.0.0");
  });

  it("idempotent second write does not corrupt", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");

    const next = applyBump({ kind: "minor", currentVersion: "1.0.0" });

    const first = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: true,
      files: { versionFile: "VERSION" },
    });
    expect(first.wrote).toBe(true);
    expect(await readVersionFile(cwd)).toBe("1.1.0");

    const second = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: true,
      files: { versionFile: "VERSION" },
    });
    expect(second.wrote).toBe(false);
    expect(second.reason).toBe("already-current");
    expect(await readVersionFile(cwd)).toBe("1.1.0");
  });

  it("major-reset 1.4.2 + env 2 → 2.0.0", () => {
    expect(
      applyBump({
        kind: "major-reset",
        currentVersion: "1.4.2",
        envMajor: 2,
      }),
    ).toBe("2.0.0");
  });

  it("fork refuses write", async () => {
    const cwd = await makeTempCwd();
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");

    const guards = decideBumpGuards({
      isFork: true,
      baseBranch: "main",
      headBranch: "feat/x",
      prodBranch: "main",
      developBranch: "dev",
      isMergedToProd: true,
    });

    expect(guards.allowWrite).toBe(false);

    const next = applyBump({ kind: "minor", currentVersion: "1.0.0" });
    const result = await writeVersion({
      cwd,
      nextVersion: next,
      dryRun: false,
      allowWrite: guards.allowWrite,
      files: { versionFile: "VERSION" },
    });

    expect(result.wrote).toBe(false);
    expect(await readVersionFile(cwd)).toBe("1.0.0");
  });

  it("sync-from-prod forces none / no write", () => {
    const guards = decideBumpGuards({
      isFork: false,
      baseBranch: "dev",
      headBranch: "main",
      prodBranch: "main",
      developBranch: "dev",
      isMergedToProd: true,
    });
    expect(guards.forceKindNone).toBe(true);
    expect(guards.allowWrite).toBe(false);
  });

  it("envMajor below current major throws", () => {
    expect(() =>
      applyBump({ kind: "patch", currentVersion: "1.2.3", envMajor: 0 }),
    ).toThrow(/envMajor 0 is below current major 1/);
  });

  it("major skip 1→3 → 3.0.0", () => {
    expect(
      applyBump({
        kind: "major-reset",
        currentVersion: "1.4.2",
        envMajor: 3,
      }),
    ).toBe("3.0.0");
  });

  it("skip label forces none / no write", () => {
    const guards = decideBumpGuards({
      isFork: false,
      baseBranch: "main",
      headBranch: "feat/x",
      prodBranch: "main",
      developBranch: "dev",
      isMergedToProd: true,
      labels: ["skip-version"],
    });
    expect(guards.forceKindNone).toBe(true);
    expect(guards.allowWrite).toBe(false);
  });
});
