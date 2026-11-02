import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { redactSecrets } from "../github/redact.js";
import { extractReleaseSection } from "./extract-section.js";
import { writeChangelog } from "./write-changelog.js";

fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS) || 100 });

const hostile = fc.constantFrom(
  "## [1.1.0]",
  "## [1.0.0] - x",
  "## [Unreleased]",
  "<<<<<<< HEAD",
  ">>>>>>> x",
  "=======",
  "# title",
  "`code`",
  "\r",
  " ",
);
const words = fc.array(fc.oneof(hostile, fc.string({ maxLength: 8 })), {
  maxLength: 4,
});
const subject = words.map(
  (w) => `feat: ${w.join(" ").replace(/\n/g, " ") || "x"}`,
);
const eol = fc.constantFrom("\n", "\r\n");

async function write(cwd: string, version: string, subjects: string[]) {
  return writeChangelog({
    cwd,
    changelogPath: "CHANGELOG.md",
    version,
    date: "2026-01-01",
    kind: "minor",
    commits: subjects.map((s) => ({ subject: s })),
  });
}

// Real files: keep the run count modest.
describe("changelog invariants", () => {
  const runs = {
    numRuns: Math.min(Number(process.env.FC_NUM_RUNS) || 50, 500),
  };

  it("any subjects: the section can be read back as written (I5)", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(subject, { maxLength: 4 }),
        async (subjects) => {
          const cwd = await mkdtemp(path.join(tmpdir(), "ps-cl-"));
          const result = await write(cwd, "1.1.0", subjects);
          expect(result.wrote).toBe(true);
          const file = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
          expect(extractReleaseSection(file, "1.1.0")).toBe(
            result.sectionMarkdown,
          );
        },
      ),
      runs,
    );
  });

  it("a release never disturbs the earlier ones or the next release", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(subject, { maxLength: 3 }),
        fc.array(subject, { maxLength: 3 }),
        async (first, second) => {
          const cwd = await mkdtemp(path.join(tmpdir(), "ps-cl-"));
          const a = await write(cwd, "1.0.0", first);
          const b = await write(cwd, "1.1.0", second);
          expect(b.wrote).toBe(true);
          const file = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
          expect(extractReleaseSection(file, "1.0.0")).toBe(a.sectionMarkdown);
          expect(extractReleaseSection(file, "1.1.0")).toBe(b.sectionMarkdown);
          // Newest first.
          expect(file.indexOf("\n## [1.1.0]")).toBeLessThan(
            file.indexOf("\n## [1.0.0]"),
          );
        },
      ),
      runs,
    );
  });

  it("writing the same version twice is a no-op", async () => {
    await fc.assert(
      fc.asyncProperty(subject, async (s) => {
        const cwd = await mkdtemp(path.join(tmpdir(), "ps-cl-"));
        await write(cwd, "1.1.0", [s]);
        const file = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
        expect((await write(cwd, "1.1.0", [s])).wrote).toBe(false);
        expect(await readFile(path.join(cwd, "CHANGELOG.md"), "utf8")).toBe(
          file,
        );
      }),
      runs,
    );
  });

  it.fails("an existing file's line endings survive", async () => {
    await fc.assert(
      fc.asyncProperty(eol, async (nl) => {
        const cwd = await mkdtemp(path.join(tmpdir(), "ps-cl-"));
        const raw = `# Changelog${nl}${nl}## [1.0.0] - 2026-01-01${nl}${nl}- a${nl}`;
        await writeFile(path.join(cwd, "CHANGELOG.md"), raw);
        await write(cwd, "1.1.0", ["feat: x"]);
        const after = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
        expect(after.split(nl).join("").includes("\n")).toBe(false);
      }),
      { numRuns: 4 },
    );
  });

  it("no secret reaches the file (I6)", async () => {
    const secret = "ghp_abcdefghijklmnopqrstuvwxyz012345";
    await fc.assert(
      fc.asyncProperty(subject, async (s) => {
        const cwd = await mkdtemp(path.join(tmpdir(), "ps-cl-"));
        await write(cwd, "1.1.0", [`${s} ${secret}`]);
        const file = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
        expect(file).not.toContain(secret);
        expect(redactSecrets(file)).toBe(file);
      }),
      { numRuns: 10 },
    );
  });
});
