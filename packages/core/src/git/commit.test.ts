import { describe, expect, it, vi } from "vitest";
import { commitBumpFiles } from "./commit.js";
import type { GitExec } from "./types.js";

describe("commitBumpFiles", () => {
  it("sets local git identity before add/commit", async () => {
    const exec = vi.fn<GitExec>(async () => ({ stdout: "", stderr: "" }));
    await commitBumpFiles({
      cwd: "/tmp/repo",
      message: "chore(release): v1.0.0 [skip version]",
      paths: ["VERSION", "package.json"],
      exec,
    });
    expect(exec.mock.calls.map((c) => c[0])).toEqual([
      ["config", "user.name", "github-actions[bot]"],
      [
        "config",
        "user.email",
        "41898282+github-actions[bot]@users.noreply.github.com",
      ],
      ["add", "--", "VERSION", "package.json"],
      ["commit", "-m", "chore(release): v1.0.0 [skip version]"],
    ]);
  });

  it("refuses commit without skip trailer", async () => {
    const exec = vi.fn();
    await expect(
      commitBumpFiles({
        cwd: "/tmp",
        message: "chore(release): v1.0.0",
        paths: ["VERSION"],
        exec,
      }),
    ).rejects.toThrow(/skip version/);
    expect(exec).not.toHaveBeenCalled();
  });
});
