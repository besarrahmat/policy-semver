import { readFile } from "node:fs/promises";
import path from "node:path";
import { classify } from "@policy-semver/core";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cmdBump } from "./cmd-bump.js";
import { cmdClassify } from "./cmd-classify.js";
import { cmdVerify } from "./cmd-verify.js";
import { EXIT_POLICY } from "./exit.js";
import { MIN_CONFIG, makeTempApp } from "./test-helpers.js";

const cases = [
  { commits: [{ subject: "feat: x" }], kind: "minor" },
  { commits: [{ subject: "fix: y" }], kind: "patch" },
  { commits: [{ subject: "docs: z" }], kind: "none" },
] as const;

describe("parity classify", () => {
  let cwd: string;

  beforeAll(async () => {
    cwd = await makeTempApp({ version: "1.2.3" });
  });

  afterEach(() => vi.restoreAllMocks());

  it("CLI classify matches core", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    for (const c of cases) {
      const coreKind = classify({
        commits: [...c.commits],
        currentVersion: "1.2.3",
        envMajor: null,
      }).kind;
      expect(coreKind).toBe(c.kind);

      log.mockClear();
      await cmdClassify({
        flags: { cwd, config: "versioning.config.json", json: true },
        commits: [...c.commits],
      });
      const printed = JSON.parse(String(log.mock.calls[0]?.[0])) as {
        kind: string;
      };
      expect(printed.kind).toBe(coreKind);
    }
  });
});

describe("verify failures", () => {
  it("unknown config key → throw (policy)", async () => {
    const cwd = await makeTempApp({
      config: { schemaVersion: "1", nope: true },
    });
    await expect(
      cmdVerify({
        flags: { cwd, config: "versioning.config.json", json: true },
      }),
    ).rejects.toThrow(/invalid versioning config|additional|nope/i);
  });

  it("dual-source mismatch → throw", async () => {
    const cwd = await makeTempApp({
      version: "1.0.0",
      packageVersion: "2.0.0",
    });
    await expect(
      cmdVerify({
        flags: { cwd, config: "versioning.config.json", json: true },
      }),
    ).rejects.toThrow(/dual-source mismatch/);
  });
});

describe("bump dirty write", () => {
  afterEach(() => vi.restoreAllMocks());

  it("dirty tree + --write without --force → EXIT_POLICY, no write", async () => {
    const cwd = await makeTempApp({ version: "1.0.0" });
    const beforeV = await readFile(path.join(cwd, "VERSION"), "utf8");
    const beforePkg = await readFile(path.join(cwd, "package.json"), "utf8");

    vi.spyOn(await import("./git-clean.js"), "isGitClean").mockResolvedValue(
      false,
    );
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await cmdBump({
      flags: { cwd, config: "versioning.config.json", json: true },
      dryRun: false,
      write: true,
      force: false,
      commits: [{ subject: "feat: x" }],
    });
    expect(code).toBe(EXIT_POLICY);
    expect(await readFile(path.join(cwd, "VERSION"), "utf8")).toBe(beforeV);
    expect(await readFile(path.join(cwd, "package.json"), "utf8")).toBe(
      beforePkg,
    );
  });

  it("dirty + --write --force writes", async () => {
    const cwd = await makeTempApp({ version: "1.0.0" });
    vi.spyOn(await import("./git-clean.js"), "isGitClean").mockResolvedValue(
      false,
    );
    vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await cmdBump({
      flags: { cwd, config: "versioning.config.json", json: true },
      dryRun: false,
      write: true,
      force: true,
      commits: [{ subject: "feat: x" }],
    });
    expect(code).toBe(0);
    expect(await readFile(path.join(cwd, "VERSION"), "utf8")).toBe("1.1.0\n");
  });
});

describe("bump beforeBump hook", () => {
  afterEach(() => vi.restoreAllMocks());

  it("failing beforeBump leaves VERSION unchanged", async () => {
    const cwd = await makeTempApp({
      version: "1.0.0",
      config: {
        ...MIN_CONFIG,
        hooks: {
          beforeBump: "exit 1",
          afterTag: null,
          afterRelease: null,
        },
      },
    });
    const beforeV = await readFile(path.join(cwd, "VERSION"), "utf8");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const hookExec = vi.fn(async () => {
      throw Object.assign(new Error("Command failed"), { code: 1 });
    });

    await expect(
      cmdBump({
        flags: { cwd, config: "versioning.config.json", json: true },
        dryRun: false,
        write: true,
        force: true,
        commits: [{ subject: "feat: x" }],
        hookExec,
      }),
    ).rejects.toThrow(/hook beforeBump failed/);

    expect(hookExec).toHaveBeenCalled();
    expect(await readFile(path.join(cwd, "VERSION"), "utf8")).toBe(beforeV);
  });
});
