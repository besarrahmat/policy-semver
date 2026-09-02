import path from "node:path";
import {
  readBothConfigured,
  tryReadPackageJsonVersion,
  tryReadVersionFile,
} from "../dual-source/index.js";
import type { ReadVersionInput, VersionFiles } from "./types.js";

/** Dual-source / single-source only — does not inspect extra package.json files. */
export async function readPrimaryVersion(
  input: ReadVersionInput,
): Promise<string> {
  const { cwd, files } = input;
  const hasVf = Boolean(files.versionFile);
  const hasPkg = Boolean(files.packageJson);

  if (hasVf && hasPkg) {
    return readBothConfigured(
      cwd,
      files.versionFile as string,
      files.packageJson as string,
    );
  }

  if (hasVf) {
    const vf = await tryReadVersionFile(cwd, files.versionFile as string);
    if (vf === null) {
      throw new Error(
        `readVersion: VERSION not found at ${path.join(cwd, files.versionFile as string)}`,
      );
    }
    return vf;
  }

  if (hasPkg) {
    const pkg = await tryReadPackageJsonVersion(
      cwd,
      files.packageJson as string,
    );
    if (pkg === null) {
      throw new Error(
        `readVersion: package.json not found at ${path.join(cwd, files.packageJson as string)}`,
      );
    }
    return pkg;
  }

  throw new Error("readVersion: no versionFiles configured");
}

export async function assertExtraPackageJsonMatch(
  cwd: string,
  extras: string[] | undefined,
  expected: string,
): Promise<void> {
  if (!extras?.length) return;
  for (const rel of extras) {
    const got = await tryReadPackageJsonVersion(cwd, rel);
    if (got === null) {
      throw new Error(
        `readVersion: package.json not found at ${path.join(cwd, rel)}`,
      );
    }
    if (got !== expected) {
      throw new Error(
        `versionFiles mismatch: expected ${JSON.stringify(expected)} at ${rel}, got ${JSON.stringify(got)}`,
      );
    }
  }
}

export async function extrasNeedWrite(
  cwd: string,
  extras: string[] | undefined,
  nextVersion: string,
): Promise<boolean> {
  if (!extras?.length) return false;
  for (const rel of extras) {
    const got = await tryReadPackageJsonVersion(cwd, rel);
    if (got !== nextVersion) return true;
  }
  return false;
}

function primaryFiles(files: VersionFiles): VersionFiles {
  return {
    ...(files.versionFile !== undefined
      ? { versionFile: files.versionFile }
      : {}),
    ...(files.packageJson !== undefined
      ? { packageJson: files.packageJson }
      : {}),
  };
}

export async function readVersion(input: ReadVersionInput): Promise<string> {
  const version = await readPrimaryVersion({
    cwd: input.cwd,
    files: primaryFiles(input.files),
  });
  await assertExtraPackageJsonMatch(
    input.cwd,
    input.files.extraPackageJson,
    version,
  );
  return version;
}
