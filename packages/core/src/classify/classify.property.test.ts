import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { decideBumpGuards } from "../bump/guards.js";
import { classify } from "./classify.js";
import { normalizeSubject, subjectType } from "./subject.js";

fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS) || 100 });

const text = fc.string({ unit: "binary", maxLength: 60 });
const commit = fc.record({
  subject: text,
  body: fc.option(text, { nil: undefined }),
});
const commits = fc.array(commit, { maxLength: 6 }).map((list) =>
  list.map(({ subject, body }) => ({
    subject,
    ...(body !== undefined ? { body } : {}),
  })),
);
const version = fc
  .tuple(fc.nat(99), fc.nat(99), fc.nat(99))
  .map((p) => p.join("."));

describe("classify invariants", () => {
  it("never returns a major without the env, for any text (I3)", () => {
    fc.assert(
      fc.property(commits, text, version, (list, prTitle, currentVersion) => {
        const { kind } = classify({
          commits: list,
          prTitle,
          currentVersion,
          envMajor: null,
        });
        expect(["minor", "patch", "none"]).toContain(kind);
      }),
    );
  });

  it("any feat: commit makes it at least a minor, whatever surrounds it", () => {
    fc.assert(
      fc.property(commits, commits, version, (a, b, currentVersion) => {
        const { kind } = classify({
          commits: [...a, { subject: "feat: x" }, ...b],
          currentVersion,
          envMajor: null,
        });
        expect(kind).toBe("minor");
      }),
    );
  });

  it("whitespace and emoji around a subject do not change its type", () => {
    const decoration = fc.constantFrom(
      "",
      " ",
      "  ",
      "\t",
      "✨ ",
      " ✨ ",
      "🚀",
    );
    fc.assert(
      fc.property(
        decoration,
        decoration,
        fc.constantFrom("feat", "fix", "docs"),
        (before, after, type) => {
          const subject = `${before}${type}: x${after}`;
          expect(subjectType(normalizeSubject(subject))).toBe(type);
        },
      ),
    );
  });

  it("normalizeSubject is idempotent", () => {
    fc.assert(
      fc.property(text, (s) => {
        const once = normalizeSubject(s);
        expect(normalizeSubject(once)).toBe(once);
      }),
    );
  });
});

describe("skip marker invariants", () => {
  const guards = (t: string) =>
    decideBumpGuards({
      isFork: false,
      baseBranch: "main",
      headBranch: "dev",
      prodBranch: "main",
      developBranch: "dev",
      textsForSkip: [t],
      isMergedToProd: true,
    });
  const plain = fc.string({ maxLength: 30 }).filter((s) => !s.includes("["));

  it("text without the marker never cancels a release", () => {
    fc.assert(
      fc.property(plain, (t) => {
        expect(guards(t).allowWrite).toBe(true);
      }),
    );
  });

  it("a marker ending a line always cancels, whatever precedes it", () => {
    fc.assert(
      fc.property(plain, plain, (before, after) => {
        const t = `${before.replace(/[\r\n]/g, " ")} [skip version]\n${after}`;
        expect(guards(t).allowWrite).toBe(false);
      }),
    );
  });

  it("a marker followed by prose on its line never cancels", () => {
    fc.assert(
      fc.property(plain, (before) => {
        const t = `${before.replace(/[\r\n]/g, " ")} [skip version] is a marker`;
        expect(guards(t).allowWrite).toBe(true);
      }),
    );
  });
});
