import path from "node:path";
import { loadConfig, readVersion } from "@policy-semver/core";
import { EXIT_OK } from "./exit.js";
import type { GlobalFlags } from "./parse-args.js";
import { toVersionFiles } from "./version-files.js";

/**
 * Schema load (fail-closed) + dual-source match via `readVersion`.
 * Throws on invalid config / mismatch → caller maps to EXIT_POLICY.
 */
export async function cmdVerify(input: {
  flags: GlobalFlags;
}): Promise<number> {
  const configPath = path.join(input.flags.cwd, input.flags.config);
  const config = await loadConfig(configPath);
  const files = toVersionFiles(config.versionFiles);
  const version = await readVersion({ cwd: input.flags.cwd, files });

  const payload = {
    ok: true,
    version,
    configPath,
    versionFiles: config.versionFiles,
  };
  console.log(
    input.flags.json
      ? JSON.stringify(payload)
      : JSON.stringify(payload, null, 2),
  );
  return EXIT_OK;
}
