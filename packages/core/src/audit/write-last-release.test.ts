import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { lastReleasePath, writeLastRelease } from "./write-last-release.js";

describe("writeLastRelease", () => {
  it("creates .policy-semver/ and writes last-release.json", async () => {
    const cwd = await mkdtemp(path.join(tmpdir(), "ps-audit-"));
    const record = await writeLastRelease({
      cwd,
      version: "0.1.0",
      kind: "minor",
      gitSha: "abc123",
      tag: "v0.1.0",
      at: "2026-08-08T00:00:00.000Z",
    });

    expect(record).toEqual({
      version: "0.1.0",
      kind: "minor",
      gitSha: "abc123",
      tag: "v0.1.0",
      at: "2026-08-08T00:00:00.000Z",
    });
    expect(await readFile(lastReleasePath(cwd), "utf8")).toBe(
      `${JSON.stringify(record, null, 2)}\n`,
    );
  });
});
