import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  formatSemVer,
  isSemVerString,
  parseSemVer,
} from "../bump/parse-version.js";
import { assertDualSourceMatch } from "./assert-match.js";

export async function tryReadVersionFile(
  cwd: string,
  rel: string,
): Promise<string | null> {
  const p = path.join(cwd, rel);
  try {
    const raw = (await readFile(p, "utf8")).trim();
    if (!isSemVerString(raw)) {
      throw new Error(`malformed VERSION at ${p}: ${JSON.stringify(raw)}`);
    }
    return formatSemVer(parseSemVer(raw));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

export async function tryReadPackageJsonVersion(
  cwd: string,
  rel: string,
): Promise<string | null> {
  const p = path.join(cwd, rel);
  try {
    const pkg = JSON.parse(await readFile(p, "utf8")) as { version?: unknown };
    if (typeof pkg.version !== "string" || !isSemVerString(pkg.version)) {
      throw new Error(`malformed package.json version at ${p}`);
    }
    return formatSemVer(parseSemVer(pkg.version));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}

/**
 * Both paths configured: require match when both files exist.
 * If only one file exists on disk → return that (single-source OK).
 */
export async function readBothConfigured(
  cwd: string,
  versionFile: string,
  packageJson: string,
): Promise<string> {
  const vf = await tryReadVersionFile(cwd, versionFile);
  const pkg = await tryReadPackageJsonVersion(cwd, packageJson);

  if (vf !== null && pkg !== null) {
    assertDualSourceMatch(vf, pkg);
    return vf;
  }
  if (vf !== null) return vf;
  if (pkg !== null) return pkg;
  throw new Error("readVersion: neither VERSION nor package.json found");
}
