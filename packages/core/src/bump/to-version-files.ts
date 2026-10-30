import type { VersionFiles } from "./types.js";

/**
 * Map config `versionFiles` string list → bump `VersionFiles`.
 * Exact file names only: an entry this cannot write must fail, not be dropped.
 */
export function toVersionFiles(versionFiles: string[]): VersionFiles {
  const isVersionFile = (f: string) => /(^|\/)VERSION$/.test(f);
  const isPackageJson = (f: string) => /(^|\/)package\.json$/.test(f);

  const unsupported = versionFiles.find(
    (f) => !isVersionFile(f) && !isPackageJson(f),
  );
  if (unsupported !== undefined) {
    throw new Error(
      `unsupported versionFiles entry ${JSON.stringify(unsupported)}: use a VERSION or package.json path`,
    );
  }
  const [versionFile, secondVersionFile] = versionFiles.filter(isVersionFile);
  if (secondVersionFile !== undefined) {
    throw new Error(
      `versionFiles allows one VERSION file: ${versionFile}, ${secondVersionFile}`,
    );
  }
  const [packageJson, ...extraPackageJson] = versionFiles.filter(isPackageJson);
  return {
    ...(versionFile !== undefined ? { versionFile } : {}),
    ...(packageJson !== undefined ? { packageJson } : {}),
    ...(extraPackageJson.length > 0 ? { extraPackageJson } : {}),
  };
}
