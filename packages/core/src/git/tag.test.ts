import { describe, expect, it, vi } from "vitest";
import { assertTagMatchesVersion, createAnnotatedTag } from "./tag.js";

describe("createAnnotatedTag", () => {
  it("tag exists → throw (no overwrite)", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args[0] === "rev-parse") {
        return { stdout: "abc123\n", stderr: "" };
      }
      throw new Error(`unexpected git ${args.join(" ")}`);
    });

    await expect(
      createAnnotatedTag({
        cwd: "/tmp",
        tag: "v1.0.0",
        message: "v1.0.0",
        exec,
      }),
    ).rejects.toThrow(/tag already exists/);

    expect(exec).toHaveBeenCalledWith(
      ["rev-parse", "-q", "--verify", "refs/tags/v1.0.0"],
      expect.anything(),
    );
    // must NOT call `git tag -a …`
    expect(exec.mock.calls.some((c) => c[0]?.[0] === "tag")).toBe(false);
  });

  it("tag missing → create annotated tag", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args[0] === "rev-parse") {
        throw new Error("not found");
      }
      return { stdout: "", stderr: "" };
    });

    await createAnnotatedTag({
      cwd: "/tmp",
      tag: "v1.2.3",
      message: "v1.2.3",
      exec,
    });

    expect(exec).toHaveBeenCalledWith(
      ["tag", "-a", "--no-sign", "v1.2.3", "-m", "v1.2.3"],
      expect.anything(),
    );
  });
});

describe("assertTagMatchesVersion", () => {
  it("tags exist but VERSION tag missing → throw", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args.includes("--is-inside-work-tree")) {
        return { stdout: "true\n", stderr: "" };
      }
      if (args[0] === "tag") return { stdout: "v1.0.0\n", stderr: "" };
      throw new Error("not found");
    });
    await expect(
      assertTagMatchesVersion({
        cwd: "/tmp",
        version: "1.2.3",
        tagPrefix: "v",
        exec,
      }),
    ).rejects.toThrow(/expected v1\.2\.3/);
  });

  it("no tags yet → skip", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args.includes("--is-inside-work-tree")) {
        return { stdout: "true\n", stderr: "" };
      }
      if (args[0] === "tag") return { stdout: "\n", stderr: "" };
      throw new Error("not found");
    });
    await expect(
      assertTagMatchesVersion({
        cwd: "/tmp",
        version: "0.0.0",
        exec,
      }),
    ).resolves.toBeUndefined();
  });
});
