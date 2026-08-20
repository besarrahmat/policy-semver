import { describe, expect, it } from "vitest";
import { decideActionMode } from "./decision.js";

const base = {
    prodBranch: "main",
    developBranch: "dev",
    eventName: "pull_request",
} as const;

describe("decideActionMode (6.B0)", () => {
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

    it("push → skip (no VE-13 double path)", () => {
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
});