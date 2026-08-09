import type { VersionFiles } from "@policy-semver/core";

/** Map config `versionFiles` string list → bump `VersionFiles`. */
export function toVersionFiles(versionFiles: string[]): VersionFiles {
  const versionFile = versionFiles.find(
    (f) => f === "VERSION" || /(^|\/)VERSION$/.test(f),
  );
  const packageJson = versionFiles.find((f) => f.endsWith("package.json"));
  return {
    ...(versionFile !== undefined ? { versionFile } : {}),
    ...(packageJson !== undefined ? { packageJson } : {}),
  };
}
