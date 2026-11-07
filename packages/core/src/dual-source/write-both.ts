import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parsePackageJson } from "./read-sources.js";

export async function writeVersionFile(
  cwd: string,
  rel: string,
  nextVersion: string,
): Promise<void> {
  await writeFile(path.join(cwd, rel), `${nextVersion}\n`, "utf8");
}

async function writePackageJsonVersion(
  cwd: string,
  rel: string,
  nextVersion: string,
): Promise<void> {
  const p = path.join(cwd, rel);
  const raw = await readFile(p, "utf8");
  await writeFile(p, withPackageVersion(raw, nextVersion), "utf8");
}

/**
 * Edit the text, not the parsed object: a rewrite would reorder numeric keys,
 * decode escapes, and change line endings across the consumer's file. A nested
 * "version" may come first, so each match is checked against the parsed result.
 */
function withPackageVersion(raw: string, nextVersion: string): string {
  for (const match of raw.matchAll(/("version"\s*:\s*)"[^"]*"/g)) {
    const end = match.index + match[0].length;
    const edited = `${raw.slice(0, match.index)}${match[1]}"${nextVersion}"${raw.slice(end)}`;
    const pkg = parsePackageJson(edited);
    if (pkg.version === nextVersion) return edited;
  }
  throw new Error('package.json has no top-level "version" string');
}

export type WriteBothInput = {
  cwd: string;
  versionFile: string;
  packageJson: string;
  extraPackageJson?: string[];
  nextVersion: string;
};

type Snapshot = { rel: string; content: string };

async function snapshotFiles(cwd: string, rels: string[]): Promise<Snapshot[]> {
  return Promise.all(
    rels.map(async (rel) => ({
      rel,
      content: await readFile(path.join(cwd, rel), "utf8"),
    })),
  );
}

async function restoreFiles(cwd: string, prev: Snapshot[]): Promise<void> {
  // allSettled: a failed restore must not replace the error that caused it.
  await Promise.allSettled(
    prev.map((p) => writeFile(path.join(cwd, p.rel), p.content, "utf8")),
  );
}

/**
 * Logical-atomic dual write: snapshot listed files → write all → restore all
 * on failure.
 */
export async function writeBothAtomically(
  input: WriteBothInput,
): Promise<void> {
  const extras = input.extraPackageJson ?? [];
  const pkgRels = [input.packageJson, ...extras];
  const prev = await snapshotFiles(input.cwd, [input.versionFile, ...pkgRels]);

  try {
    await writeVersionFile(input.cwd, input.versionFile, input.nextVersion);
    for (const rel of pkgRels) {
      await writePackageJsonVersion(input.cwd, rel, input.nextVersion);
    }
  } catch (err) {
    await restoreFiles(input.cwd, prev);
    throw err;
  }
}

export async function writePackageJsonFilesAtomically(input: {
  cwd: string;
  packageJsonFiles: string[];
  nextVersion: string;
}): Promise<void> {
  const rels = input.packageJsonFiles;
  if (rels.length === 0) return;
  const prev = await snapshotFiles(input.cwd, rels);
  try {
    for (const rel of rels) {
      await writePackageJsonVersion(input.cwd, rel, input.nextVersion);
    }
  } catch (err) {
    await restoreFiles(input.cwd, prev);
    throw err;
  }
}
