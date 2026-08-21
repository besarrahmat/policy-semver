import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { writeChangelog } from "./write-changelog.js";

async function tmp(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "ps-changelog-"));
}

describe("writeChangelog", () => {
  it("kind none → no mutation", async () => {
    const cwd = await tmp();
    const r = await writeChangelog({
      cwd,
      changelogPath: "CHANGELOG.md",
      version: "1.1.0",
      date: "2026-08-08",
      kind: "none",
      commits: [{ subject: "feat: x" }],
    });
    expect(r.wrote).toBe(false);
    expect(r.reason).toBe("kind-none");
    await expect(
      readFile(path.join(cwd, "CHANGELOG.md"), "utf8"),
    ).rejects.toThrow();
  });

  it("creates CHANGELOG.md with header + section", async () => {
    const cwd = await tmp();
    const r = await writeChangelog({
      cwd,
      changelogPath: "CHANGELOG.md",
      version: "1.1.0",
      date: "2026-08-08",
      kind: "minor",
      commits: [
        { subject: "feat: add login" },
        { subject: "fix: null crash" },
        { subject: "chore: deps" },
      ],
    });
    expect(r.wrote).toBe(true);
    expect(r.reason).toBe("created");
    const body = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
    expect(body).toMatch(/^# Changelog/m);
    expect(body).toMatch(/## \[Unreleased\]/);
    expect(body).toContain("## [1.1.0] - 2026-08-08");
    expect(body).toContain("### Added");
    expect(body).toContain("- add login");
    expect(body).toContain("### Fixed");
    expect(body).toContain("### Changed");
  });

  it("docs-only commits under minor still only feat/fix/other bullets", async () => {
    const cwd = await tmp();
    await writeChangelog({
      cwd,
      changelogPath: "CHANGELOG.md",
      version: "1.0.1",
      date: "2026-08-08",
      kind: "patch",
      commits: [{ subject: "docs: readme" }, { subject: "fix: typo" }],
    });
    const body = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
    expect(body).not.toMatch(/### Added/);
    expect(body).toContain("### Fixed");
    expect(body).not.toMatch(/readme/i);
  });

  it("redacts secrets in changelog section before write", async () => {
    const cwd = await tmp();
    const r = await writeChangelog({
      cwd,
      changelogPath: "CHANGELOG.md",
      version: "1.0.1",
      date: "2026-08-08",
      kind: "patch",
      commits: [
        {
          subject: "fix: leak ghp_abcdefghijklmnopqrstuvwxyz12 in message",
        },
      ],
    });
    expect(r.wrote).toBe(true);
    expect(r.sectionMarkdown).toContain("[REDACTED]");
    expect(r.sectionMarkdown).not.toMatch(/ghp_/);
    const body = await readFile(path.join(cwd, "CHANGELOG.md"), "utf8");
    expect(body).toContain("[REDACTED]");
    expect(body).not.toMatch(/ghp_/);
  });

  it("conflict markers fail loud", async () => {
    const cwd = await tmp();
    await writeFile(
      path.join(cwd, "CHANGELOG.md"),
      "# Changelog\n<<<<<<< HEAD\n",
    );
    await expect(
      writeChangelog({
        cwd,
        changelogPath: "CHANGELOG.md",
        version: "1.0.1",
        date: "2026-08-08",
        kind: "patch",
        commits: [{ subject: "fix: x" }],
      }),
    ).rejects.toThrow(/conflict markers/);
  });

  it("retries write once then fails", async () => {
    const cwd = await tmp();
    const writeFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("EACCES"))
      .mockRejectedValueOnce(new Error("EACCES"));
    await expect(
      writeChangelog({
        cwd,
        changelogPath: "CHANGELOG.md",
        version: "1.0.1",
        date: "2026-08-08",
        kind: "patch",
        commits: [{ subject: "fix: x" }],
        writeFile: writeFn as typeof writeFile,
      }),
    ).rejects.toThrow(/CHANGELOG conflict after retry/);
    expect(writeFn).toHaveBeenCalledTimes(2);
  });

  it("retries write once then succeeds", async () => {
    const cwd = await tmp();
    const writeFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("EACCES"))
      .mockResolvedValueOnce(undefined);
    const r = await writeChangelog({
      cwd,
      changelogPath: "CHANGELOG.md",
      version: "1.0.1",
      date: "2026-08-08",
      kind: "patch",
      commits: [{ subject: "fix: x" }],
      writeFile: writeFn as typeof writeFile,
    });
    expect(r.wrote).toBe(true);
    expect(writeFn).toHaveBeenCalledTimes(2);
  });
});
