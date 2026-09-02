import type { ClassifyKind } from "../classify/locks.js";

export type VersionFiles = {
  /** Prefer config `versionFiles`; support at least one. */
  versionFile?: string; // e.g. "VERSION"
  /** Dual-source primary (first `*.package.json` in config). */
  packageJson?: string; // e.g. "package.json"
  /**
   * Further `*.package.json` entries in `versionFiles`. Same version as
   * primary (lockstep), not independent workspace bumps.
   */
  extraPackageJson?: string[];
};

export type ReadVersionInput = {
  cwd: string;
  files: VersionFiles;
};

export type ApplyBumpInput = {
  kind: ClassifyKind;
  currentVersion: string;
  envMajor?: number | null;
};

export type WriteVersionInput = {
  cwd: string;
  nextVersion: string;
  dryRun: boolean;
  allowWrite: boolean;
  files: VersionFiles;
};

export type WriteVersionResult = {
  nextVersion: string;
  wrote: boolean;
  reason?: "dry-run" | "allow-write-false" | "already-current" | "written";
};

export type BumpGuardContext = {
  /** true when PR is from a fork — Action sets this */
  isFork: boolean;
  /** PR base branch name */
  baseBranch: string;
  /** PR head branch / source ref short name */
  headBranch: string;
  prodBranch: string; // from config, default "main"
  developBranch: string; // from config, default "dev"
  /** PR labels (lowercase compare OK) */
  labels?: string[];
  /** commit subjects + bodies + optional PR title/body for skip trailer */
  textsForSkip?: string[];
  skipLabels?: string[]; // config default ["skip-version"]
  skipTrailers?: string[]; // config default ["skip version"] → match "[skip version]"
  /** merged into prod? open PR / synchronize → treat as not merged */
  isMergedToProd?: boolean;
};

export type BumpGuardDecision = {
  allowWrite: boolean;
  forceKindNone: boolean;
  reasons: string[];
};
