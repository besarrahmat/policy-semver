import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { type ClassifyKind, classify } from "@policy-semver/core";
import { EXIT_OK } from "./exit.js";
import type { GlobalFlags } from "./parse-args.js";

export type GoldenFixture = {
  name: string;
  input: {
    commits: { subject: string; body?: string }[];
    prTitle?: string;
    currentVersion: string;
    envMajor?: number | null;
  };
  expected: { kind: ClassifyKind; warnings?: string[] };
};

export async function findClassifierDir(start: string): Promise<string> {
  let dir = path.resolve(start);
  for (;;) {
    const candidate = path.join(dir, "fixtures", "classifier");
    try {
      if ((await stat(candidate)).isDirectory()) {
        return candidate;
      }
    } catch {
      // walk up
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `fixtures/classifier not found (walked up from ${path.resolve(start)})`,
      );
    }
    dir = parent;
  }
}

export async function runClassifierFixtures(
  dir: string,
): Promise<{ passed: number; dir: string }> {
  const names = (await readdir(dir)).filter((n) => n.endsWith(".json")).sort();
  if (names.length === 0) {
    throw new Error(`no *.json in ${dir}`);
  }

  for (const file of names) {
    const raw = await readFile(path.join(dir, file), "utf8");
    let fixture: GoldenFixture;
    try {
      fixture = JSON.parse(raw) as GoldenFixture;
    } catch {
      throw new Error(`golden fixture ${file}: invalid JSON`);
    }
    if (fixture.expected?.kind === undefined) {
      throw new Error(`golden fixture ${file}: missing expected.kind`);
    }

    const prTitle = fixture.input.prTitle;
    const result = classify({
      commits: fixture.input.commits,
      currentVersion: fixture.input.currentVersion,
      ...(prTitle !== undefined && prTitle !== "" ? { prTitle } : {}),
      ...(fixture.input.envMajor !== undefined
        ? { envMajor: fixture.input.envMajor }
        : {}),
    });

    if (result.kind !== fixture.expected.kind) {
      throw new Error(
        `golden fixture ${file}: kind expected ${fixture.expected.kind}, got ${result.kind}`,
      );
    }
    if (fixture.expected.warnings !== undefined) {
      const want = fixture.expected.warnings;
      const got = result.warnings;
      if (want.length !== got.length || want.some((w, i) => w !== got[i])) {
        throw new Error(
          `golden fixture ${file}: warnings mismatch: expected ${JSON.stringify(want)}, got ${JSON.stringify(got)}`,
        );
      }
    }
  }

  return { passed: names.length, dir };
}

export async function cmdTest(input: { flags: GlobalFlags }): Promise<number> {
  const { passed, dir } = await runClassifierFixtures(
    await findClassifierDir(input.flags.cwd),
  );
  const payload = { ok: true, passed, dir };
  console.log(
    input.flags.json
      ? JSON.stringify(payload)
      : JSON.stringify(payload, null, 2),
  );
  return EXIT_OK;
}
