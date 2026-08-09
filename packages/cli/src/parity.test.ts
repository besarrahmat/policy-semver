import { readFile } from "node:fs/promises";
import path from "node:path";
import { classify } from "@policy-semver/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cmdBump } from "./cmd-bump.js";
import { cmdClassify } from "./cmd-classify.js";
import { cmdVerify } from "./cmd-verify.js";
import { EXIT_POLICY } from "./exit.js";
import { makeTempApp } from "./test-helpers.js";

const cases = [
  { commits: [{ subject: "feat: x" }], kind: "minor" },
  { commits: [{ subject: "fix: y" }], kind: "patch" },
  { commits: [{ subject: "docs: z" }], kind: "none" },
] as const;

describe("parity classify", () => {
  afterEach(() => vi.restoreAllMocks());

  for (const c of cases) {
    it(`${c.commits[0].subject} → ${c.kind}`, async () => {
      const cwd = await makeTempApp({ version: "1.2.3" });
      const coreKind = classify({
        commits: [...c.commits],
        currentVersion: "1.2.3",
        envMajor: null,
      }).kind;
      expect(coreKind).toBe(c.kind);

      const log = vi.spyOn(console, "log").mockImplementation(() => {});
      await cmdClassify({
        flags: { cwd, config: "versioning.config.json", json: true },
        commits: [...c.commits],
      });
      const printed = JSON.parse(String(log.mock.calls[0]?.[0])) as {
        kind: string;
      };
      expect(printed.kind).toBe(coreKind);
    });
  }
});

describe("verify failures", () => {
  it("unknown config key → throw (policy)", async () => {
    const unknown = JSON.parse(
      await readFile(
        path.resolve(
          __dirname,
          "../../../fixtures/config/invalid/unknown-key.json",
        ),
        "utf8",
      ),
    ) as Record<string, unknown>;
    const cwd = await makeTempApp({ config: unknown });
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
});
