import { describe, expect, it } from "vitest";
import { decideActionMode } from "./decision.js";

const base = {
  prodBranch: "main",
  developBranch: "dev",
  eventName: "pull_request",
} as const;

describe("decideActionMode", () => {
  it("fork → dry-run-comment even if merged", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: true,
        baseBranch: "main",
        headBranch: "feat",
        action: "closed",
        merged: true,
      }).mode,
    ).toBe("dry-run-comment");
  });

  it("sync develop←prod → force-none", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "dev",
        headBranch: "main",
        action: "opened",
      }),
    ).toMatchObject({ mode: "force-none", reason: "sync-from-prod" });
  });

  it("non-prod base → skip", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "dev",
        headBranch: "feat",
        action: "opened",
      }).mode,
    ).toBe("skip");
  });

  it("never writes on feature base", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "feat-b",
        headBranch: "feat-a",
        action: "closed",
        merged: true,
      }),
    ).toMatchObject({ mode: "skip", allowWrite: false });
  });

  it("prod PR synchronize → dry-run-comment", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "main",
        headBranch: "feat",
        action: "synchronize",
      }).mode,
    ).toBe("dry-run-comment");
  });

  it("synchronize → dry-run-comment and allowWrite false", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "main",
        headBranch: "feat",
        action: "synchronize",
      }),
    ).toMatchObject({ mode: "dry-run-comment", allowWrite: false });
  });

  it("prod PR merged → write", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "main",
        headBranch: "feat",
        action: "closed",
        merged: true,
      }).mode,
    ).toBe("write");
  });

  it("merge_group → write", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "main",
        headBranch: "feat",
        eventName: "merge_group",
      }).mode,
    ).toBe("write");
  });

  it("push → skip", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: false,
        baseBranch: "main",
        headBranch: "feat",
        eventName: "push",
      }).mode,
    ).toBe("skip");
  });

  it("merged write and push skip are mutually exclusive", () => {
    const merged = decideActionMode({
      ...base,
      isFork: false,
      baseBranch: "main",
      headBranch: "feat",
      action: "closed",
      merged: true,
    });
    const push = decideActionMode({
      ...base,
      isFork: false,
      baseBranch: "main",
      headBranch: "feat",
      eventName: "push",
    });
    const closedUnmerged = decideActionMode({
      ...base,
      isFork: false,
      baseBranch: "main",
      headBranch: "feat",
      action: "closed",
      merged: false,
    });
    expect(merged).toMatchObject({ mode: "write", allowWrite: true });
    expect(push).toMatchObject({ mode: "skip", allowWrite: false });
    expect(closedUnmerged.mode).not.toBe("write");
    expect(closedUnmerged.allowWrite).toBe(false);
  });

  it("fork merged still allowWrite false", () => {
    expect(
      decideActionMode({
        ...base,
        isFork: true,
        baseBranch: "main",
        headBranch: "feat",
        action: "closed",
        merged: true,
      }),
    ).toMatchObject({ mode: "dry-run-comment", allowWrite: false });
  });
});
