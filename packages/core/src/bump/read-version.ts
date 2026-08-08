import { readFile } from "node:fs/promises";
import path from "node:path";
import { formatSemVer, isSemVerString, parseSemVer } from "./parse-version.js";
import type { ReadVersionInput } from "./types.js";

export async function readVersion(input: ReadVersionInput): Promise<string> {
  const { cwd, files } = input;

  if (files.versionFile) {
    const p = path.join(cwd, files.versionFile);
    const raw = (await readFile(p, "utf8")).trim();
    if (!isSemVerString(raw)) {
      throw new Error(`malformed VERSION at ${p}: ${JSON.stringify(raw)}`);
    }
    return formatSemVer(parseSemVer(raw));
  }

  if (files.packageJson) {
    const p = path.join(cwd, files.packageJson);
    const pkg = JSON.parse(await readFile(p, "utf8")) as { version?: unknown };
    if (typeof pkg.version !== "string" || !isSemVerString(pkg.version)) {
      throw new Error(`malformed package.json version at ${p}`);
    }
    return formatSemVer(parseSemVer(pkg.version));
  }

  throw new Error("readVersion: no versionFiles configured");
}
