import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { WriteVersionInput, WriteVersionResult } from "./types.js";

export async function writeVersion(
  input: WriteVersionInput,
): Promise<WriteVersionResult> {
  const { cwd, nextVersion, dryRun, allowWrite, files } = input;

  if (dryRun) {
    return { nextVersion, wrote: false, reason: "dry-run" };
  }
  if (!allowWrite) {
    return { nextVersion, wrote: false, reason: "allow-write-false" };
  }

  // Idempotent: already at nextVersion → no-op
  // (read current from the same target file(s) you would write)

  if (files.versionFile) {
    const p = path.join(cwd, files.versionFile);
    let current = "";
    try {
      current = (await readFile(p, "utf8")).trim();
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    if (current === nextVersion) {
      return { nextVersion, wrote: false, reason: "already-current" };
    }
    await writeFile(p, `${nextVersion}\n`, "utf8");
    return { nextVersion, wrote: true, reason: "written" };
  }

  if (files.packageJson) {
    const p = path.join(cwd, files.packageJson);
    const raw = await readFile(p, "utf8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    if (pkg.version === nextVersion) {
      return { nextVersion, wrote: false, reason: "already-current" };
    }
    pkg.version = nextVersion;
    await writeFile(p, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
    return { nextVersion, wrote: true, reason: "written" };
  }

  throw new Error("writeVersion: no versionFiles configured");
}
