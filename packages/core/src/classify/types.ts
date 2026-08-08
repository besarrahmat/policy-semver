import type { ClassifyKind } from "./locks.js";

export type ClassifyCommit = {
  subject: string;
  body?: string;
};

export type ClassifyInput = {
  commits: ClassifyCommit[];
  prTitle?: string;
  envMajor?: number | null;
  currentVersion: string;
  skip?: boolean;
};

export type ClassifyResult = {
  kind: ClassifyKind;
  warnings: string[];
};
