export const CORE_PACKAGE = "@policy-semver/core" as const;

export function ping(): string {
  return "ok";
}

export type {
  LastReleaseRecord,
  WriteLastReleaseInput,
} from "./audit/index.js";
export {
  AUDIT_DIR,
  AUDIT_FILE,
  lastReleasePath,
  lastReleaseRelPath,
  writeLastRelease,
} from "./audit/index.js";
export type {
  ApplyBumpInput,
  BumpGuardContext,
  BumpGuardDecision,
  ReadVersionInput,
  SemVerParts,
  VersionFiles,
  WriteVersionInput,
  WriteVersionResult,
} from "./bump/index.js";
export {
  applyBump,
  assertBotCommitMessageSafe,
  BOT_SKIP_TRAILER,
  BUMP_SAFETY,
  decideBumpGuards,
  formatBotBumpCommitMessage,
  formatSemVer,
  isSemVerString,
  parseSemVer,
  readVersion,
  writeVersion,
} from "./bump/index.js";
export {
  BUCKET_TO_SECTION,
  CHANGELOG_FORMAT,
  CHANGELOG_SECTIONS,
  type ChangelogCommit,
  type ChangelogSection,
  mapCommitsToSections,
  renderReleaseSection,
  type SectionBuckets,
  type WriteChangelogInput,
  type WriteChangelogResult,
  writeChangelog,
} from "./changelog/index.js";
export type {
  ClassifyCommit,
  ClassifyInput,
  ClassifyResult,
} from "./classify/index.js";
export {
  CLASSIFY_KINDS,
  CLASSIFY_NEVER_AUTO_MAJOR,
  type ClassifyKind,
  classify,
} from "./classify/index.js";
export type { VersioningConfig } from "./config/index.js";
export {
  CONFIG_SCHEMA_DIALECT,
  CONFIG_SCHEMA_URI,
  CONFIG_VALIDATOR,
  loadConfig,
  WORKSPACES_V1,
} from "./config/index.js";
export {
  assertDualSourceMatch,
  DUAL_SOURCE,
  readBothConfigured,
  readVersionAtRef,
  tryReadPackageJsonVersion,
  tryReadVersionFile,
  type WriteBothInput,
  writeBothAtomically,
} from "./dual-source/index.js";
export type { CommitBumpInput, PushInput, TagInput } from "./git/index.js";
export {
  assertRemoteTagCompatible,
  assertTagMatchesVersion,
  commitBumpFiles,
  createAnnotatedTag,
  defaultGitExec,
  pushRefs,
  tagExists,
} from "./git/index.js";
export type { CreateReleaseInput } from "./github/index.js";
export {
  createGitHubRelease,
  GITHUB_RELEASE_CLIENT,
  redactSecrets,
  SECRET_REDACT_PATTERNS,
  SECRET_REDACT_REPLACEMENT,
  TAG_EXISTS_FAILS,
} from "./github/index.js";
export type { HookExec, HookName, RunHookInput } from "./hooks/index.js";
export {
  defaultHookExec,
  HOOK_ENV,
  HOOK_NAMES,
  HOOK_SHELL,
  hookEnvVars,
  runHook,
} from "./hooks/index.js";
export type { RunReleaseInput, RunReleaseResult } from "./release/index.js";
export { runRelease } from "./release/index.js";
