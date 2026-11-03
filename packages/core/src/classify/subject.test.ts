import { describe, expect, it } from "vitest";
import {
  hasBreakingBang,
  hasBreakingFooter,
  isConventionalSubject,
  isMergeSubject,
  looksLikeFeat,
  normalizeSubject,
  subjectType,
} from "./subject.js";

describe("normalizeSubject", () => {
  it.each([
    ["  ✨ feat: x  ", "feat: x"],
    ["🎉🎉 feat: x", "feat: x"],
    ["fix 🎉: x", "fix 🎉: x"],
  ])("%j → %j", (raw, expected) => {
    expect(normalizeSubject(raw)).toBe(expected);
  });
});

describe("isMergeSubject", () => {
  it.each(["Merge branch 'x'", "Merge abc1234 into main", "Merged in feature"])(
    "%j is a merge",
    (subject) => {
      expect(isMergeSubject(subject)).toBe(true);
    },
  );

  it.each([
    "fix: merge branch handling",
    "fix: merge abc1234 into main",
    "docs: merged in the new guide",
  ])("%j is real work, so it still counts", (subject) => {
    expect(isMergeSubject(subject)).toBe(false);
  });
});

describe("subjectType", () => {
  it.each([
    ["fix: x", "fix"],
    ["fix : x", "fix"],
    ["fix(ab): x", "fix"],
    ["fix(): x", "fix"],
    ["fix  (ab)  : x", "fix"],
    ["prefix: x", "other"],
    ["docs: x", "docs"],
    ["docs  (ab)  : x", "docs"],
    ["mydocs: x", "other"],
  ])("%j → %s", (subject, type) => {
    expect(subjectType(subject)).toBe(type);
  });
});

describe("isConventionalSubject", () => {
  it.each([
    "chore: x",
    "chore(ab): x",
    "chore  (ab): x",
    "feat  &  fix: x",
    "feat&fix: x",
    "a & bc: x",
  ])("%j is conventional", (subject) => {
    expect(isConventionalSubject(subject)).toBe(true);
  });

  it.each(["Update docs", "[JIRA-1] feat: x", "a & 1: x"])(
    "%j is not",
    (subject) => {
      expect(isConventionalSubject(subject)).toBe(false);
    },
  );
});

describe("looksLikeFeat", () => {
  it.each(["[JIRA-1]feat: x", "[JIRA-1]  feat: x"])("%j does", (subject) => {
    expect(looksLikeFeat(subject)).toBe(true);
  });
});

describe("hasBreakingBang", () => {
  it.each([
    "feat!: x",
    "feat(ab)!: x",
    "feat  (ab)!  : x",
    "feat  &  fix!: x",
    "feat&fix!: x",
  ])("%j does", (subject) => {
    expect(hasBreakingBang(subject)).toBe(true);
  });

  it.each(["feat: x", "see feat!: x"])("%j does not", (subject) => {
    expect(hasBreakingBang(subject)).toBe(false);
  });
});

describe("hasBreakingFooter", () => {
  it.each(["x\n\nBREAKING CHANGE: y", "BREAKING-CHANGE: y"])(
    "%j does",
    (text) => {
      expect(hasBreakingFooter(text)).toBe(true);
    },
  );

  it("prose that mentions it does not", () => {
    expect(hasBreakingFooter("not a BREAKING CHANGE: y")).toBe(false);
  });
});
