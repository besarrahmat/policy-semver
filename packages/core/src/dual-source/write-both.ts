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
  nextVersion: string;
};

/**
 * Logical-atomic dual write: snapshot both → write both → restore both on failure.
 */
export async function writeBothAtomically(
  input: WriteBothInput,
): Promise<void> {
  const vfPath = path.join(input.cwd, input.versionFile);
  const pkgPath = path.join(input.cwd, input.packageJson);
  const vfPrev = await readFile(vfPath, "utf8");
  const pkgPrev = await readFile(pkgPath, "utf8");

  try {
    await writeVersionFile(input.cwd, input.versionFile, input.nextVersion);
    await writePackageJsonVersion(
      input.cwd,
      input.packageJson,
      input.nextVersion,
    );
  } catch (err) {
    await writeFile(vfPath, vfPrev, "utf8");
    await writeFile(pkgPath, pkgPrev, "utf8");
    throw err;
  }
}
