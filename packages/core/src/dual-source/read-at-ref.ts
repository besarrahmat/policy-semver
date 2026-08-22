import {
  formatSemVer,
  isSemVerString,
  parseSemVer,
} from "../bump/parse-version.js";
import type { VersionFiles } from "../bump/types.js";
import { defaultGitExec } from "../git/exec.js";
import type { GitExec } from "../git/types.js";
import { assertDualSourceMatch } from "./assert-match.js";

function parseVersionFile(raw: string, label: string): string {
  const trimmed = raw.trim();
  if (!isSemVerString(trimmed)) {
    throw new Error(
      `malformed VERSION at ${label}: ${JSON.stringify(trimmed)}`,
    );
  }
  return formatSemVer(parseSemVer(trimmed));
}

function parsePackageVersion(raw: string, label: string): string {
  const pkg = JSON.parse(raw) as { version?: unknown };
  if (typeof pkg.version !== "string" || !isSemVerString(pkg.version)) {
    throw new Error(`malformed package.json version at ${label}`);
  }
  return formatSemVer(parseSemVer(pkg.version));
}

async function showAtRef(
  exec: GitExec,
  cwd: string,
  ref: string,
  rel: string,
): Promise<string | null> {
  try {
    const { stdout } = await exec(["show", `${ref}:${rel}`], { cwd });
    return stdout;
  } catch {
    return null;
  }
}

/** Read dual-source version from a git ref (e.g. origin/main). */
export async function readVersionAtRef(input: {
  cwd: string;
  ref: string;
  files: VersionFiles;
  exec?: GitExec;
}): Promise<string | null> {
  const exec = input.exec ?? defaultGitExec;
  const vfRel = input.files.versionFile;
  const pkgRel = input.files.packageJson;

  const vfRaw =
    vfRel !== undefined
      ? await showAtRef(exec, input.cwd, input.ref, vfRel)
      : null;
  const pkgRaw =
    pkgRel !== undefined
      ? await showAtRef(exec, input.cwd, input.ref, pkgRel)
      : null;

  const vf =
    vfRaw !== null ? parseVersionFile(vfRaw, `${input.ref}:${vfRel}`) : null;
  const pkg =
    pkgRaw !== null
      ? parsePackageVersion(pkgRaw, `${input.ref}:${pkgRel}`)
      : null;

  if (vf !== null && pkg !== null) {
    assertDualSourceMatch(vf, pkg);
    return vf;
  }
  if (vf !== null) return vf;
  if (pkg !== null) return pkg;
  return null;
}
