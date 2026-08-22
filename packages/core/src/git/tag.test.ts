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
      if (args[0] === "rev-parse" && args.includes("-q")) {
        throw new Error("not found");
      }
      if (args[0] === "ls-remote") {
        return { stdout: "", stderr: "" };
      }
      if (args[0] === "tag") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`unexpected git ${args.join(" ")}`);
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

  it("remote tag SHA differs → throw", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args[0] === "rev-parse" && args.includes("-q")) {
        throw new Error("not local");
      }
      if (args[0] === "ls-remote") {
        return {
          stdout: "deadbeef\trefs/tags/v1.2.3\n",
          stderr: "",
        };
      }
      if (args[0] === "rev-parse" && args.includes("HEAD")) {
        return { stdout: "abc123\n", stderr: "" };
      }
      throw new Error(`unexpected git ${args.join(" ")}`);
    });
    await expect(
      createAnnotatedTag({
        cwd: "/tmp",
        tag: "v1.2.3",
        message: "v1.2.3",
        exec,
      }),
    ).rejects.toThrow(/mirror tag conflict/);
    expect(exec.mock.calls.some((c) => c[0]?.[0] === "tag")).toBe(false);
  });

  it("remote tag SHA matches HEAD → tag already exists", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args[0] === "rev-parse" && args.includes("-q")) {
        throw new Error("not local");
      }
      if (args[0] === "ls-remote") {
        return {
          stdout: "abc123\trefs/tags/v1.2.3\n",
          stderr: "",
        };
      }
      if (args[0] === "rev-parse" && args.includes("HEAD")) {
        return { stdout: "abc123\n", stderr: "" };
      }
      throw new Error(`unexpected git ${args.join(" ")}`);
    });
    await expect(
      createAnnotatedTag({
        cwd: "/tmp",
        tag: "v1.2.3",
        message: "v1.2.3",
        exec,
      }),
    ).rejects.toThrow(/tag already exists/);
    expect(exec.mock.calls.some((c) => c[0]?.[0] === "tag")).toBe(false);
  });

  it("ls-remote uses input.remote", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args[0] === "rev-parse" && args.includes("-q")) {
        throw new Error("not local");
      }
      if (args[0] === "ls-remote") {
        expect(args).toEqual([
          "ls-remote",
          "--tags",
          "mirror",
          "refs/tags/v1.2.3",
        ]);
        return {
          stdout: "deadbeef\trefs/tags/v1.2.3\n",
          stderr: "",
        };
      }
      if (args[0] === "rev-parse" && args.includes("HEAD")) {
        return { stdout: "abc123\n", stderr: "" };
      }
      throw new Error(`unexpected git ${args.join(" ")}`);
    });
    await expect(
      createAnnotatedTag({
        cwd: "/tmp",
        tag: "v1.2.3",
        message: "v1.2.3",
        remote: "mirror",
        exec,
      }),
    ).rejects.toThrow(/mirror tag conflict/);
  });

  it("no remote (ls-remote throws) → still create", async () => {
    const exec = vi.fn(async (args: string[]) => {
      if (args[0] === "rev-parse" && args.includes("-q")) {
        throw new Error("not local");
      }
      if (args[0] === "ls-remote") {
        throw new Error("no remote");
      }
      if (args[0] === "tag") {
        return { stdout: "", stderr: "" };
      }
      throw new Error(`unexpected git ${args.join(" ")}`);
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
