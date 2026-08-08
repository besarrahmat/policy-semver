import path from "node:path";
import {
  readBothConfigured,
  tryReadPackageJsonVersion,
  tryReadVersionFile,
} from "../dual-source/index.js";
import type { ReadVersionInput } from "./types.js";

export async function readVersion(input: ReadVersionInput): Promise<string> {
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
