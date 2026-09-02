import type { VersionFiles } from "./types.js";

/** Map config `versionFiles` string list → bump `VersionFiles`. */
export function toVersionFiles(versionFiles: string[]): VersionFiles {
  const versionFile = versionFiles.find(
    (f) => f === "VERSION" || /(^|\/)VERSION$/.test(f),
  );
  const packageJsons = versionFiles.filter((f) => f.endsWith("package.json"));
  const [packageJson, ...extraPackageJson] = packageJsons;
  return {
    ...(versionFile !== undefined ? { versionFile } : {}),
    ...(packageJson !== undefined ? { packageJson } : {}),
    ...(extraPackageJson.length > 0 ? { extraPackageJson } : {}),
  };
}
