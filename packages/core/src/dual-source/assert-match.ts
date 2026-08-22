/**
 * when both sources exist on disk, versions must match (do not pick one).
 */
export function assertDualSourceMatch(
  versionFileVersion: string,
  packageJsonVersion: string,
): void {
  if (versionFileVersion !== packageJsonVersion) {
    throw new Error(
      `dual-source mismatch: VERSION=${JSON.stringify(versionFileVersion)} package.json=${JSON.stringify(packageJsonVersion)}`,
    );
  }
}
