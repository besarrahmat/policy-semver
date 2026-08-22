import type { ClassifyKind } from "../classify/locks.js";

export type LastReleaseRecord = {
  version: string;
  kind: Exclude<ClassifyKind, "none">;
  gitSha: string;
  tag: string;
  at: string;
};

export type WriteLastReleaseInput = {
  cwd: string;
  version: string;
  kind: Exclude<ClassifyKind, "none">;
  gitSha: string;
  tag: string;
  at?: string;
};
