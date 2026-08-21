import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cmdTest,
  findClassifierDir,
  runClassifierFixtures,
} from "./cmd-test.js";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const REQUIRED_CLASSIFIER_FIXTURES = [
  "feat-plain.json",
  "feat-scope.json",
  "feat-and-fix.json",
  "docs-only.json",
  "fix-patch.json",
  "feature-typo-patch.json",
  "emoji-feat.json",
  "merge-ignored.json",
  "title-feat-docs-commits.json",
  "breaking-warn-only.json",
  "major-env-reset.json",
] as const;

describe("golden fixtures", () => {
  afterEach(() => vi.restoreAllMocks());

  it("starter set under fixtures/classifier all pass", async () => {
    const dir = await findClassifierDir(repoRoot);
    const names = (await readdir(dir)).filter((n) => n.endsWith(".json"));
    for (const file of REQUIRED_CLASSIFIER_FIXTURES) {
      expect(names).toContain(file);
    }
    const { passed } = await runClassifierFixtures(dir);
    expect(passed).toBeGreaterThanOrEqual(REQUIRED_CLASSIFIER_FIXTURES.length);
  });

  it("kind mismatch throws", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "ps-gold-"));
    const dir = path.join(root, "fixtures", "classifier");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      path.join(dir, "feat-plain.json"),
      `${JSON.stringify({
        name: "bad",
        input: {
          commits: [{ subject: "feat: x" }],
          prTitle: "",
          currentVersion: "1.2.3",
          envMajor: null,
        },
        expected: { kind: "patch", warnings: [] },
      })}\n`,
    );
    await expect(runClassifierFixtures(dir)).rejects.toThrow(
      /kind expected patch, got minor/,
    );
  });

  it("cmdTest walks up from --cwd", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    const code = await cmdTest({
      flags: { cwd: repoRoot, config: "versioning.config.json", json: true },
    });
    expect(code).toBe(0);
    const payload = JSON.parse(String(log.mock.calls[0]?.[0])) as {
      passed: number;
    };
    expect(payload.passed).toBeGreaterThanOrEqual(11);
  });
});
