import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { applyBump } from "./apply-bump.js";
import { parseEnvMajor } from "./parse-env-major.js";
import { formatSemVer, isSemVerString, parseSemVer } from "./parse-version.js";
import { readVersion } from "./read-version.js";
import { toVersionFiles } from "./to-version-files.js";
import { writeVersion } from "./write-version.js";

fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS) || 100 });

// Both ends: a uniform length would rarely reach Number's precision limit.
const digits = fc.oneof(
  fc.stringMatching(/^(0|[1-9][0-9]{0,3})$/),
  fc.stringMatching(/^[1-9][0-9]{15,24}$/),
);
const version = fc.tuple(digits, digits, digits).map((p) => p.join("."));

function isGreater(a: string, b: string): boolean {
  const [x, y] = [parseSemVer(a), parseSemVer(b)];
  return (
    x.major > y.major ||
    (x.major === y.major &&
      (x.minor > y.minor || (x.minor === y.minor && x.patch > y.patch)))
  );
}

describe("version invariants", () => {
  it("parse and format round-trip, or the version is refused", () => {
    fc.assert(
      fc.property(version, (v) => {
        let parts: ReturnType<typeof parseSemVer>;
        try {
          parts = parseSemVer(v);
        } catch {
          return;
        }
        expect(formatSemVer(parts)).toBe(v);
      }),
    );
  });

  it("a bump yields a valid, strictly greater version, or refuses", () => {
    fc.assert(
      fc.property(
        version,
        fc.constantFrom("minor", "patch") as fc.Arbitrary<"minor" | "patch">,
        (currentVersion, kind) => {
          let next: string;
          try {
            next = applyBump({ kind, currentVersion, envMajor: null });
          } catch {
            return;
          }
          expect(isSemVerString(next)).toBe(true);
          expect(isGreater(next, currentVersion)).toBe(true);
        },
      ),
    );
  });

  it("the major env is a safe integer, or refused", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 30 }), (raw) => {
        let major: number | null;
        try {
          major = parseEnvMajor("M", raw);
        } catch {
          return;
        }
        if (major !== null) expect(Number.isSafeInteger(major)).toBe(true);
      }),
    );
    fc.assert(
      fc.property(digits, (raw) => {
        let major: number | null;
        try {
          major = parseEnvMajor("M", raw);
        } catch {
          return;
        }
        expect(Number.isSafeInteger(major)).toBe(true);
      }),
    );
  });

  it("toVersionFiles keeps every entry, or refuses", () => {
    const entry = fc.constantFrom(
      "VERSION",
      "a/VERSION",
      "package.json",
      "a/package.json",
      "b/package.json",
      "VERSION.txt",
      "package.json5",
    );
    fc.assert(
      fc.property(fc.uniqueArray(entry, { maxLength: 5 }), (list) => {
        let files: ReturnType<typeof toVersionFiles>;
        try {
          files = toVersionFiles(list);
        } catch {
          return;
        }
        const kept = [
          files.versionFile,
          files.packageJson,
          ...(files.extraPackageJson ?? []),
        ].filter(Boolean);
        expect(kept.sort()).toEqual([...list].sort());
      }),
    );
  });
});

describe("package.json write invariants (I10)", () => {
  // Real files: keep the run count modest.
  const runs = { numRuns: 25 };
  const key = fc
    .stringMatching(/^[a-z0-9]{1,6}$/)
    .filter((k) => k !== "version");
  const value = fc.oneof(
    fc.string({ maxLength: 8 }),
    fc.integer(),
    fc.boolean(),
    fc.constant(null),
    fc.record({ version: fc.constant("0.0.1") }),
  );
  const fields = fc.dictionary(key, value, { maxKeys: 5 });
  const layout = fc.constantFrom(2, 4, "\t", 0);
  const eol = fc.constantFrom("\n", "\r\n");

  it("changes the version and nothing else", async () => {
    await fc.assert(
      fc.asyncProperty(
        fields,
        fields,
        layout,
        eol,
        async (a, b, indent, nl) => {
          const cwd = await mkdtemp(path.join(tmpdir(), "ps-pkg-"));
          const rel = "package.json";
          const raw = `${JSON.stringify({ ...a, version: "1.0.0", ...b, version2: 1 }, null, indent).replace(/\n/g, nl)}${nl}`;
          await writeFile(path.join(cwd, rel), raw);
          await writeVersion({
            cwd,
            nextVersion: "1.1.0",
            dryRun: false,
            allowWrite: true,
            files: { packageJson: rel },
          });
          const after = await readFile(path.join(cwd, rel), "utf8");
          expect(JSON.parse(after).version).toBe("1.1.0");
          expect(
            after
              .replace('"version": "1.1.0"', '"version": "1.0.0"')
              .replace('"version":"1.1.0"', '"version":"1.0.0"'),
          ).toBe(raw);
          expect(await readVersion({ cwd, files: { packageJson: rel } })).toBe(
            "1.1.0",
          );
        },
      ),
      runs,
    );
  });
});
