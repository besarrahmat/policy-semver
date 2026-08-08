import { formatSemVer, parseSemVer } from "./parse-version.js";
import type { ApplyBumpInput } from "./types.js";

export function applyBump(input: ApplyBumpInput): string {
  const { kind, currentVersion, envMajor } = input;
  const cur = parseSemVer(currentVersion);

  if (envMajor != null && envMajor < cur.major) {
    throw new Error(`envMajor ${envMajor} is below current major ${cur.major}`);
  }

  switch (kind) {
    case "none":
      return currentVersion.trim();
    case "major-reset": {
      if (envMajor == null || !Number.isInteger(envMajor)) {
        throw new Error("major-reset requires integer envMajor");
      }
      if (envMajor < cur.major) {
        throw new Error(`envMajor ${envMajor} < current major ${cur.major}`);
      }
      // N.0.0 — classify only emits major-reset when envMajor > current.
      return formatSemVer({ major: envMajor, minor: 0, patch: 0 });
    }
    case "minor":
      // bump minor, patch → 0
      return formatSemVer({
        major: cur.major,
        minor: cur.minor + 1,
        patch: 0,
      });
    case "patch":
      return formatSemVer({
        major: cur.major,
        minor: cur.minor,
        patch: cur.patch + 1,
      });
    default: {
      const _exhaustive: never = kind;
      return _exhaustive;
    }
  }
}
