import type { ClassifyKind } from "../classify/locks.js";
import type { ChangelogSection } from "./locks.js";

export type ChangelogCommit = {
  subject: string;
  body?: string;
};

export type WriteChangelogInput = {
  cwd: string;
  /** Relative path; default from config `changelogPath` */
  changelogPath: string;
  version: string; // X.Y.Z
  date: string; // YYYY-MM-DD
  kind: ClassifyKind;
  commits: ChangelogCommit[];
  /** attempt count; caller may retry once */
  attempt?: number;
  /** Test seam; default `fs/promises.writeFile`. */
  writeFile?: typeof import("node:fs/promises").writeFile;
};

export type WriteChangelogResult = {
  wrote: boolean;
  reason:
    | "kind-none"
    | "created"
    | "appended"
    | "already-present"
    | "conflict-fail";
  path: string;
  /** Rendered section body (without file header) — useful for Release later */
  sectionMarkdown?: string;
};

export type SectionBuckets = Partial<Record<ChangelogSection, string[]>>;
