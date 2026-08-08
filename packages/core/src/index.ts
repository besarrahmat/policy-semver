export const CORE_PACKAGE = "@policy-semver/core" as const;

export function ping(): string {
  return "ok";
}

export type { VersioningConfig } from "./config/index.js";
export {
  CONFIG_SCHEMA_DIALECT,
  CONFIG_SCHEMA_URI,
  CONFIG_VALIDATOR,
  loadConfig,
} from "./config/index.js";
