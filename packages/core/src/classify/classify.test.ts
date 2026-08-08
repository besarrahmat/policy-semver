import { describe, expect, it } from "vitest";
import { classify } from "./classify.js";
import type { ClassifyInput } from "./types.js";

const v = "1.2.3";

function input(
  partial: Partial<ClassifyInput> & Pick<ClassifyInput, "commits">,
): ClassifyInput {
  return { currentVersion: v, ...partial };
}

describe("classify", () => {
  it("feat: / feat(scope): / FEAT: → minor", () => {
    expect(classify(input({ commits: [{ subject: "feat: x" }] })).kind).toBe(
      "minor",
    );
    expect(
      classify(input({ commits: [{ subject: "feat(api): x" }] })).kind,
    ).toBe("minor");
    expect(classify(input({ commits: [{ subject: "FEAT: x" }] })).kind).toBe(
      "minor",
    );
  });

  it("feat & fix: / feat&fix: → minor", () => {
    expect(
      classify(input({ commits: [{ subject: "feat & fix: x" }] })).kind,
    ).toBe("minor");
    expect(
      classify(input({ commits: [{ subject: "feat&fix: x" }] })).kind,
    ).toBe("minor");
    expect(
      classify(input({ commits: [{ subject: "feat  &  fix: x" }] })).kind,
    ).toBe("minor");
  });

  it("docs: / docs(scope): alone → none", () => {
    expect(classify(input({ commits: [{ subject: "docs: x" }] })).kind).toBe(
      "none",
    );
    expect(
      classify(input({ commits: [{ subject: "docs(readme): x" }] })).kind,
    ).toBe("none");
  });

  it("fix: / chore: / unknown → patch", () => {
    expect(classify(input({ commits: [{ subject: "fix: x" }] })).kind).toBe(
      "patch",
    );
    expect(classify(input({ commits: [{ subject: "chore: x" }] })).kind).toBe(
      "patch",
    );
    expect(
      classify(input({ commits: [{ subject: "random subject" }] })).kind,
    ).toBe("patch");
  });

  it("feature: typo → patch not minor", () => {
    expect(
      classify(input({ commits: [{ subject: "feature: typo" }] })).kind,
    ).toBe("patch");
  });

  it("strips leading emoji then classifies", () => {
    expect(classify(input({ commits: [{ subject: "✨ feat: x" }] })).kind).toBe(
      "minor",
    );
  });

  it("ignores merge subjects", () => {
    expect(
      classify(
        input({ commits: [{ subject: "Merge pull request #1 from a/b" }] }),
      ).kind,
    ).toBe("none");
    expect(
      classify(
        input({ commits: [{ subject: "Merge branch 'dev' into main" }] }),
      ).kind,
    ).toBe("none");
  });

  it("empty commits + empty title → none", () => {
    expect(classify(input({ commits: [] })).kind).toBe("none");
    expect(classify(input({ commits: [], prTitle: "" })).kind).toBe("none");
    expect(classify(input({ commits: [], prTitle: "   " })).kind).toBe("none");
  });

  it("title feat + docs commits → minor", () => {
    expect(
      classify(
        input({
          prTitle: "feat: title",
          commits: [{ subject: "docs: only" }],
        }),
      ).kind,
    ).toBe("minor");
  });

  it("title docs + feat commit → minor", () => {
    expect(
      classify(
        input({
          prTitle: "docs: title",
          commits: [{ subject: "feat: commit" }],
        }),
      ).kind,
    ).toBe("minor");
  });

  it("feat!: / BREAKING → warning + not major", () => {
    const bang = classify(input({ commits: [{ subject: "feat!: break" }] }));
    expect(bang.kind).toBe("minor");
    expect(bang.warnings.length).toBeGreaterThan(0);

    const emojiBang = classify(
      input({ commits: [{ subject: "💥 feat!: break" }] }),
    );
    expect(emojiBang.kind).toBe("minor");
    expect(emojiBang.warnings.length).toBeGreaterThan(0);

    const scoped = classify(
      input({ commits: [{ subject: "feat(api)!: break" }] }),
    );
    expect(scoped.kind).toBe("minor");
    expect(scoped.warnings.length).toBeGreaterThan(0);

    const body = classify(
      input({ commits: [{ subject: "fix: x", body: "BREAKING CHANGE: yes" }] }),
    );
    expect(body.kind).toBe("patch");
    expect(body.warnings.length).toBeGreaterThan(0);
  });

  it("ignores feat in body only", () => {
    const r = classify(
      input({ commits: [{ subject: "fix: x", body: "feat: ignored" }] }),
    );
    expect(r.kind).toBe("patch");
    expect(r.warnings).toEqual([]);
  });

  it("envMajor raised → major-reset wins over docs", () => {
    const r = classify(
      input({
        commits: [{ subject: "docs: only" }],
        currentVersion: "1.0.0",
        envMajor: 2,
      }),
    );
    expect(r.kind).toBe("major-reset");
  });

  it("envMajor equal or unset does not major-reset", () => {
    expect(
      classify(input({ commits: [{ subject: "feat: x" }], envMajor: 1 })).kind,
    ).toBe("minor");
    expect(classify(input({ commits: [{ subject: "feat: x" }] })).kind).toBe(
      "minor",
    );
  });

  it("skip flag → none", () => {
    expect(
      classify(input({ commits: [{ subject: "feat: x" }], skip: true })).kind,
    ).toBe("none");
  });
});
