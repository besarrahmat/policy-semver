import { describe, expect, it } from "vitest";
import { decideBumpGuards } from "./guards.js";

const ctx = {
  isFork: false,
  baseBranch: "main",
  headBranch: "feature",
  prodBranch: "main",
  developBranch: "dev",
};

it.each([
  "chore(release): v1.0.0 [skip version]",
  "body line\n[skip version]\nmore",
])("honours a skip marker ending a line: %j", (text) => {
  expect(decideBumpGuards({ ...ctx, textsForSkip: [text] }).forceKindNone).toBe(
    true,
  );
});

it("ignores prose that merely mentions the marker", () => {
  const decision = decideBumpGuards({
    ...ctx,
    textsForSkip: ["docs mention [skip version] syntax"],
  });
  expect(decision.forceKindNone).toBe(false);
});

describe("what a decision says", () => {
  const allowed = { allowWrite: true, forceKindNone: false, reasons: [] };

  it("a plain merge to prod writes", () => {
    expect(decideBumpGuards(ctx)).toEqual(allowed);
    expect(decideBumpGuards({ ...ctx, isMergedToProd: true })).toEqual(allowed);
  });

  it.each([
    [
      "a fork",
      { isFork: true },
      { allowWrite: false, forceKindNone: false },
      "fork: allowWrite=false",
    ],
    [
      "the sync label, any case",
      { labels: ["other", "Sync-From-Prod"] },
      { allowWrite: false, forceKindNone: true },
      "sync-from-prod: force none / no write",
    ],
    [
      "not merged yet",
      { isMergedToProd: false },
      { allowWrite: false, forceKindNone: false },
      "not merged to prod: dry-run only",
    ],
    [
      "a skip label",
      { labels: ["skip-version"] },
      { allowWrite: false, forceKindNone: true },
      "skip label",
    ],
    [
      "a skip marker",
      { textsForSkip: ["x [skip version]"] },
      { allowWrite: false, forceKindNone: true },
      "skip trailer in subject/body",
    ],
  ])("%s", (_name, change, flags, reason) => {
    expect(decideBumpGuards({ ...ctx, ...change })).toEqual({
      ...flags,
      reasons: [reason],
    });
  });

  it("prod into develop is a sync", () => {
    expect(
      decideBumpGuards({ ...ctx, baseBranch: "dev", headBranch: "main" }),
    ).toEqual({
      allowWrite: false,
      forceKindNone: true,
      reasons: [
        "sync-from-prod: force none / no write",
        "non-prod base: no write",
      ],
    });
  });

  it("another branch into develop is not a sync", () => {
    expect(
      decideBumpGuards({ ...ctx, baseBranch: "dev", headBranch: "feature" }),
    ).toEqual({
      allowWrite: false,
      forceKindNone: false,
      reasons: ["non-prod base: no write"],
    });
  });

  it("a merge from a branch named like prod elsewhere is not a sync", () => {
    expect(decideBumpGuards({ ...ctx, headBranch: "main" }).forceKindNone).toBe(
      false,
    );
  });
});

describe("configured skip trailers", () => {
  const skips = (text: string, skipTrailers: string[]) =>
    decideBumpGuards({ ...ctx, skipTrailers, textsForSkip: [text] })
      .forceKindNone;

  it("the bot's own marker keeps working, so its commits never release", () => {
    expect(skips("chore(release): v1.0.0 [skip version]", ["no bump"])).toBe(
      true,
    );
  });

  it("a configured marker works next to it", () => {
    expect(skips("x [no bump]", ["no bump"])).toBe(true);
    expect(skips("x [other]", ["no bump"])).toBe(false);
  });

  it("a marker is matched literally", () => {
    expect(skips("x [no.bump]", ["no.bump"])).toBe(true);
    expect(skips("x [no-bump]", ["no.bump"])).toBe(false);
  });
});
