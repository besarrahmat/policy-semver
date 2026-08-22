import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { writeVersion } from "../bump/write-version.js";
import { runHook } from "./run-hook.js";
import type { HookExec } from "./types.js";

function failExec(code: number): HookExec {
  return async () => {
    throw Object.assign(new Error("Command failed"), { code });
  };
}

describe("runHook", () => {
  it("null command is a no-op", async () => {
    const exec = vi.fn();
    await runHook({
      name: "beforeBump",
      command: null,
      cwd: "/tmp",
      version: "1.2.3",
      kind: "minor",
      dryRun: false,
      exec,
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it("blank command is a no-op", async () => {
    const exec = vi.fn();
    await runHook({
      name: "afterTag",
      command: "  ",
      cwd: "/tmp",
      version: "1.2.3",
      kind: "minor",
      dryRun: false,
      exec,
    });
    expect(exec).not.toHaveBeenCalled();
  });

  it("passes POLICY_SEMVER_* env into the command", async () => {
    const exec = vi.fn(async () => ({ stdout: "", stderr: "" }));
    await runHook({
      name: "afterRelease",
      command: "echo released",
      cwd: "/work",
      version: "0.2.0",
      kind: "minor",
      dryRun: false,
      exec,
    });
    expect(exec).toHaveBeenCalledWith(
      "echo released",
      expect.objectContaining({
        cwd: "/work",
        env: expect.objectContaining({
          POLICY_SEMVER_VERSION: "0.2.0",
          POLICY_SEMVER_KIND: "minor",
          POLICY_SEMVER_DRY_RUN: "false",
        }),
      }),
    );
  });

  it("non-zero exit throws and names the hook", async () => {
    await expect(
      runHook({
        name: "beforeBump",
        command: "exit 1",
        cwd: "/tmp",
        version: "1.0.1",
        kind: "patch",
        dryRun: false,
        exec: failExec(1),
      }),
    ).rejects.toThrow(/hook beforeBump failed \(exit 1\)/);
  });
});

describe("failing beforeBump never writes / never tags", () => {
  it("leaves VERSION unchanged and does not call tag", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "ps-hook-bb-"));
    await writeFile(path.join(cwd, "VERSION"), "1.0.0\n");
    const tag = vi.fn();

    await expect(
      (async () => {
        await runHook({
          name: "beforeBump",
          command: "exit 1",
          cwd,
          version: "1.1.0",
          kind: "minor",
          dryRun: false,
          exec: failExec(1),
        });
        await writeVersion({
          cwd,
          nextVersion: "1.1.0",
          dryRun: false,
          allowWrite: true,
          files: { versionFile: "VERSION" },
        });
        await tag();
      })(),
    ).rejects.toThrow(/hook beforeBump failed/);

    expect(await readFile(path.join(cwd, "VERSION"), "utf8")).toBe("1.0.0\n");
    expect(tag).not.toHaveBeenCalled();
  });
});
