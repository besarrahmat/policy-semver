import { describe, expect, it, vi } from "vitest";
import { createGitHubRelease } from "./create-release.js";

describe("createGitHubRelease", () => {
  it("404 → creates release with redacted body", async () => {
    const createRelease = vi.fn(async () => ({}));
    const getReleaseByTag = vi.fn(async () => {
      const err = new Error("Not Found") as Error & { status: number };
      err.status = 404;
      throw err;
    });

    await createGitHubRelease({
      owner: "acme",
      repo: "app",
      tag: "v1.0.0",
      body: "token ghp_abcdefghijklmnopqrstuvwxyz12\n",
      octokit: { repos: { getReleaseByTag, createRelease } },
    });

    expect(createRelease).toHaveBeenCalledOnce();
    expect(createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringMatching(/\[REDACTED\]/),
        tag_name: "v1.0.0",
      }),
    );
    expect(createRelease).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.not.stringMatching(/ghp_/),
      }),
    );
  });

  it("release exists → fail, does not create", async () => {
    const createRelease = vi.fn(async () => ({}));
    const getReleaseByTag = vi.fn(async () => ({ id: 1 }));

    await expect(
      createGitHubRelease({
        owner: "acme",
        repo: "app",
        tag: "v1.0.0",
        body: "## [1.0.0]\n",
        octokit: { repos: { getReleaseByTag, createRelease } },
      }),
    ).rejects.toThrow(/release already published/);

    expect(createRelease).not.toHaveBeenCalled();
  });

  it("non-404 getReleaseByTag error → rethrow", async () => {
    const createRelease = vi.fn(async () => ({}));
    const getReleaseByTag = vi.fn(async () => {
      const err = new Error("server") as Error & { status: number };
      err.status = 500;
      throw err;
    });

    await expect(
      createGitHubRelease({
        owner: "acme",
        repo: "app",
        tag: "v1.0.0",
        body: "x",
        octokit: { repos: { getReleaseByTag, createRelease } },
      }),
    ).rejects.toThrow(/server/);

    expect(createRelease).not.toHaveBeenCalled();
  });
});
