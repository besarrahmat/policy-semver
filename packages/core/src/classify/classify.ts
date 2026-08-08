import type { ClassifyInput, ClassifyResult } from "./types.js";

function parseMajor(version: string): number {
  const major = Number.parseInt(version.split(".")[0] ?? "", 10);
  if (Number.isNaN(major)) {
    throw new Error(`invalid currentVersion: ${version}`);
  }
  return major;
}

function firstLine(text: string): string {
  return text.split("\n")[0] ?? "";
}

function isMergeSubject(subject: string): boolean {
  const s = subject.trim();
  return (
    /^merge pull request\b/i.test(s) ||
    /^merge branch\b/i.test(s) ||
    /^merge remote-tracking branch\b/i.test(s)
  );
}

function normalizeSubject(subject: string): string {
  return subject
    .replace(
      /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\uFE0F|\u200D)+\s*/u,
      "",
    )
    .trim();
}

type Bucket = "feat" | "docs" | "other" | "ignore";

function bucketSubject(normalized: string): Bucket {
  const s = normalized.trim();
  // feat & fix: / feat&fix: (optional spaces around &)
  if (/^feat\s*&\s*fix(\([^)]*\))?!?\s*:/i.test(s)) {
    return "feat";
  }
  // feat: / feat(scope): / feat!: / feat(scope)!:
  if (/^feat(\([^)]*\))?!?\s*:/i.test(s)) {
    return "feat";
  }
  // docs: / docs(scope):
  if (/^docs(\([^)]*\))?\s*:/i.test(s)) {
    return "docs";
  }
  // feature: typo, fix:, chore:, anything else → other
  return "other";
}

function hasFeatBang(normalizedFirstLine: string): boolean {
  return /^feat(\([^)]*\))?!\s*:/i.test(normalizedFirstLine);
}

function collectBreakingWarnings(input: ClassifyInput): string[] {
  const warnings: string[] = [];

  const title = input.prTitle?.trim();
  if (title) {
    const normalized = normalizeSubject(firstLine(title));
    if (hasFeatBang(normalized) || /BREAKING CHANGE/i.test(title)) {
      warnings.push(
        "Breaking change marker detected; major only via APP_VERSION_MAJOR (never auto-major)",
      );
      return warnings;
    }
  }

  for (const c of input.commits) {
    const normalized = normalizeSubject(firstLine(c.subject));
    if (hasFeatBang(normalized)) {
      warnings.push(
        "Breaking change marker detected; major only via APP_VERSION_MAJOR (never auto-major)",
      );
      return warnings;
    }
    // Body may contain BREAKING CHANGE footer; never use body for feat buckets.
    if (c.body && /BREAKING CHANGE/i.test(c.body)) {
      warnings.push(
        "Breaking change marker detected; major only via APP_VERSION_MAJOR (never auto-major)",
      );
      return warnings;
    }
  }

  return warnings;
}

export function classify(input: ClassifyInput): ClassifyResult {
  const warnings: string[] = [];

  // 1) skip?
  if (input.skip === true) {
    return { kind: "none", warnings };
  }

  const currentMajor = parseMajor(input.currentVersion);
  const envMajor = input.envMajor;

  // 2) envMajor vs current
  if (envMajor != null && envMajor < currentMajor) {
    // VE-22: prefer fail in bump (Phase 3); classify throws to surface the contract early.
    throw new Error(
      `envMajor ${envMajor} is below current major ${currentMajor} (VE-22)`,
    );
  }
  if (envMajor != null && envMajor > currentMajor) {
    // Flowchart: major-reset → Out (skip BREAKING warn / aggregate).
    return { kind: "major-reset", warnings };
  }
  // unset or equal → continue

  // 3) normalize title + commit subjects → buckets
  const texts: string[] = [];
  const title = input.prTitle?.trim();
  if (title) texts.push(title);
  for (const c of input.commits) texts.push(c.subject);

  let hasFeat = false;
  let hasOther = false;
  let hasDocs = false;

  for (const raw of texts) {
    const line = firstLine(raw);
    if (isMergeSubject(line)) continue;
    const normalized = normalizeSubject(line);
    if (normalized.length === 0) continue;
    const bucket = bucketSubject(normalized);
    if (bucket === "ignore") continue;
    if (bucket === "feat") hasFeat = true;
    else if (bucket === "docs") hasDocs = true;
    else if (bucket === "other") hasOther = true;
  }

  // 4) BREAKING / feat!: → warnings only (never auto-major)
  warnings.push(...collectBreakingWarnings(input));

  // 5) aggregate
  if (hasFeat) return { kind: "minor", warnings };
  if (hasOther) return { kind: "patch", warnings };
  if (hasDocs || texts.length === 0) return { kind: "none", warnings };
  return { kind: "none", warnings };
}
