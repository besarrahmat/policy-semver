/** How commit subjects are read. Shared so classify and the changelog cannot drift. */

export function firstLine(text: string): string {
  return text.split("\n")[0] ?? "";
}

export function normalizeSubject(subject: string): string {
  // Not \p{Emoji_Component}: it includes digits and `#`, so `123 feat: x` would read as feat.
  return subject
    .replace(
      /^(?:\p{Extended_Pictographic}|\p{Emoji_Modifier}|\p{Regional_Indicator}|\uFE0F|\u200D)+\s*/u,
      "",
    )
    .trim();
}

/** Expects a normalized subject. */
export function isMergeSubject(normalized: string): boolean {
  return (
    /^merge (?:pull request|branch|remote-tracking branch|tag)\b/i.test(
      normalized,
    ) ||
    /^merge [0-9a-f]{7,40} into\b/i.test(normalized) ||
    /^merged in\b/i.test(normalized)
  );
}

export type SubjectType = "feat" | "fix" | "docs" | "other";

/** Expects a normalized subject. `feature:` and anything else is `other`. */
export function subjectType(normalized: string): SubjectType {
  if (/^feat(?:\s*&\s*fix)?(?:\s*\([^)]*\))?!?\s*:/i.test(normalized)) {
    return "feat";
  }
  if (/^docs(?:\s*\([^)]*\))?\s*:/i.test(normalized)) return "docs";
  if (/^fix(?:\s*\([^)]*\))?!?\s*:/i.test(normalized)) return "fix";
  return "other";
}

/** `type:`, `type(scope):`, `type!:`. Expects a normalized subject. */
export function isConventionalSubject(normalized: string): boolean {
  return /^[a-z]+(?:\s*&\s*[a-z]+)?(?:\s*\([^)]*\))?!?\s*:/i.test(normalized);
}

export function hasBreakingBang(normalized: string): boolean {
  return /^[a-z]+(?:\s*&\s*[a-z]+)?(?:\s*\([^)]*\))?!\s*:/i.test(normalized);
}

/** Conventional Commits footer: at the start of a line, with a colon. */
export function hasBreakingFooter(text: string): boolean {
  return /^BREAKING[ -]CHANGE:/im.test(text);
}
