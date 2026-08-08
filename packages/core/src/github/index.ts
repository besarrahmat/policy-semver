export type { CreateReleaseInput } from "./create-release.js";
export { createGitHubRelease } from "./create-release.js";
export {
  GITHUB_RELEASE_CLIENT,
  SECRET_REDACT_PATTERNS,
  SECRET_REDACT_REPLACEMENT,
  TAG_EXISTS_FAILS,
} from "./locks.js";
export { redactSecrets } from "./redact.js";
