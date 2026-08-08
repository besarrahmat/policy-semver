/** Core SemVer X.Y.Z parts (no prerelease/build in v1). */
export type SemVerParts = {
  major: number;
  minor: number;
  patch: number;
};

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

/** True when `value` is exactly `MAJOR.MINOR.PATCH` (digits only). */
export function isSemVerString(value: string): boolean {
  return SEMVER_RE.test(value.trim());
}

/**
 * Parse a strict `X.Y.Z` version string (malformed → throw).
 * @throws Error when the string is not a valid SemVer triple
 */
export function parseSemVer(version: string): SemVerParts {
  const trimmed = version.trim();
  const m = SEMVER_RE.exec(trimmed);
  if (!m) {
    throw new Error(`malformed version: ${JSON.stringify(version)}`);
  }
  return {
    major: Number(m[1]),
    minor: Number(m[2]),
    patch: Number(m[3]),
  };
}

/** Format parts back to `X.Y.Z`. */
export function formatSemVer(parts: SemVerParts): string {
  return `${parts.major}.${parts.minor}.${parts.patch}`;
}
