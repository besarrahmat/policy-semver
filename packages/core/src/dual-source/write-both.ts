import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function writeVersionFile(
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
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  pkg.version = nextVersion;
  await writeFile(p, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
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
  await Promise.all(
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
