import {
  firstLine,
  isMergeSubject,
  normalizeSubject,
  subjectType,
} from "../classify/subject.js";
import type { ChangelogSection } from "./locks.js";
import { BUCKET_TO_SECTION } from "./locks.js";
import type { ChangelogCommit, SectionBuckets } from "./types.js";

function bulletFromSubject(raw: string): string {
  const line = normalizeSubject(firstLine(raw));
  const cleaned = line.replace(
    /^(?:feat\s*&\s*fix|feat|fix|docs|chore|refactor|test|ci|build|perf|style)(\([^)]*\))?!?\s*:\s*/i,
    "",
  );
  return cleaned.length > 0 ? cleaned : line;
}

export function mapCommitsToSections(
  commits: ChangelogCommit[],
): SectionBuckets {
  const out: SectionBuckets = {};
  const push = (section: ChangelogSection, bullet: string) => {
    const list = out[section] ?? [];
    list.push(bullet);
    out[section] = list;
  };

  for (const c of commits) {
    const normalized = normalizeSubject(firstLine(c.subject));
    if (isMergeSubject(normalized)) continue;
    const section = BUCKET_TO_SECTION[subjectType(normalized)];
    if (section === null) continue;
    push(section, bulletFromSubject(c.subject));
  }
  return out;
}

const SECTION_ORDER: ChangelogSection[] = [
  "Added",
  "Changed",
  "Deprecated",
  "Removed",
  "Fixed",
  "Security",
];

export function renderReleaseSection(input: {
  version: string;
  date: string;
  buckets: SectionBuckets;
  majorNote?: string;
}): string {
  const buckets: SectionBuckets = { ...input.buckets };
  if (input.majorNote) {
    buckets.Changed = [input.majorNote, ...(buckets.Changed ?? [])];
  }

  const lines: string[] = [`## [${input.version}] - ${input.date}`, ""];
  for (const name of SECTION_ORDER) {
    const items = buckets[name];
    if (!items || items.length === 0) continue;
    lines.push(`### ${name}`, "");
    for (const item of items) lines.push(`- ${item}`);
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}
