import { describe, expect, it, vi } from "vitest";
import { ACTION_COMMENT } from "./locks.js";
import { upsertStickyComment } from "./sticky-comment.js";

function mockOctokit(comments: { id: number; body?: string }[]) {
  return {
    rest: {
      issues: {
        listComments: vi.fn(async () => ({ data: comments })),
        updateComment: vi.fn(async () => ({})),
        createComment: vi.fn(async () => ({})),
      },
    },
  };
}

describe("upsertStickyComment", () => {
  it("updates existing marker, does not create a second", async () => {
    const octokit = mockOctokit([
      { id: 9, body: `${ACTION_COMMENT.marker}\nold` },
    ]);
    await upsertStickyComment({
      octokit: octokit as never,
      owner: "o",
      repo: "r",
      issueNumber: 1,
      body: "new",
    });
    expect(octokit.rest.issues.updateComment).toHaveBeenCalledOnce();
    expect(octokit.rest.issues.createComment).not.toHaveBeenCalled();
  });

  it("creates when marker is absent", async () => {
    const octokit = mockOctokit([]);
    await upsertStickyComment({
      octokit: octokit as never,
      owner: "o",
      repo: "r",
      issueNumber: 1,
      body: "hello",
    });
    expect(octokit.rest.issues.createComment).toHaveBeenCalledOnce();
    expect(octokit.rest.issues.updateComment).not.toHaveBeenCalled();
  });
});
