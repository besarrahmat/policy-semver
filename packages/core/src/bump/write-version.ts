import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  tryReadPackageJsonVersion,
  tryReadVersionFile,
  writeBothAtomically,
  writePackageJsonFilesAtomically,
} from "../dual-source/index.js";
import { extrasNeedWrite, readPrimaryVersion } from "./read-version.js";
import type { WriteVersionInput, WriteVersionResult } from "./types.js";

async function writeVersionFile(
  cwd: string,
  rel: string,
  nextVersion: string,
): Promise<void> {
  await writeFile(path.join(cwd, rel), `${nextVersion}\n`, "utf8");
}

async function writeSingleSource(
  cwd: string,
  nextVersion: string,
  kind: "versionFile" | "packageJson",
  rel: string,
  extras: string[],
): Promise<WriteVersionResult> {
  const extrasStale = await extrasNeedWrite(cwd, extras, nextVersion);

  if (kind === "versionFile") {
    let current = "";
    try {
      current = (await readFile(path.join(cwd, rel), "utf8")).trim();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    if (current === nextVersion && !extrasStale) {
      return { nextVersion, wrote: false, reason: "already-current" };
    }
    if (current !== nextVersion) {
      await writeVersionFile(cwd, rel, nextVersion);
    }
    await writePackageJsonFilesAtomically({
      cwd,
      packageJsonFiles: extras,
      nextVersion,
    });
    return { nextVersion, wrote: true, reason: "written" };
  }

  const raw = await readFile(path.join(cwd, rel), "utf8");
  const pkg = JSON.parse(raw) as Record<string, unknown>;
  if (pkg.version === nextVersion && !extrasStale) {
    return { nextVersion, wrote: false, reason: "already-current" };
  }
  const pkgRels = pkg.version === nextVersion ? extras : [rel, ...extras];
  await writePackageJsonFilesAtomically({
    cwd,
    packageJsonFiles: pkgRels,
    nextVersion,
  });
  return { nextVersion, wrote: true, reason: "written" };
}

export async function writeVersion(
  input: WriteVersionInput,
): Promise<WriteVersionResult> {
  const { cwd, nextVersion, dryRun, allowWrite, files } = input;
  const extras = files.extraPackageJson ?? [];

  if (dryRun) {
    return { nextVersion, wrote: false, reason: "dry-run" };
  }
  if (!allowWrite) {
    return { nextVersion, wrote: false, reason: "allow-write-false" };
  }

  const vfRel = files.versionFile;
  const pkgRel = files.packageJson;
  const bothConfigured = Boolean(vfRel) && Boolean(pkgRel);

  if (bothConfigured) {
    const vf = await tryReadVersionFile(cwd, vfRel as string);
    const pkg = await tryReadPackageJsonVersion(cwd, pkgRel as string);

    if (vf !== null && pkg !== null) {
      const current = await readPrimaryVersion({
        cwd,
        files: {
          versionFile: vfRel as string,
          packageJson: pkgRel as string,
        },
      });
      const extrasStale = await extrasNeedWrite(cwd, extras, nextVersion);
      if (current === nextVersion && !extrasStale) {
        return { nextVersion, wrote: false, reason: "already-current" };
      }
      await writeBothAtomically({
        cwd,
        versionFile: vfRel as string,
        packageJson: pkgRel as string,
        extraPackageJson: extras,
        nextVersion,
      });
      return { nextVersion, wrote: true, reason: "written" };
    }

    // Both paths configured but only one file on disk → single-source write
    if (vf !== null) {
      return writeSingleSource(
        cwd,
        nextVersion,
        "versionFile",
        vfRel as string,
        extras,
      );
    }
    if (pkg !== null) {
      return writeSingleSource(
        cwd,
        nextVersion,
        "packageJson",
        pkgRel as string,
        extras,
      );
    }
    throw new Error("writeVersion: neither VERSION nor package.json found");
  }

  if (vfRel) {
    return writeSingleSource(cwd, nextVersion, "versionFile", vfRel, extras);
  }

  if (pkgRel) {
    return writeSingleSource(cwd, nextVersion, "packageJson", pkgRel, extras);
  }

  throw new Error("writeVersion: no versionFiles configured");
}
