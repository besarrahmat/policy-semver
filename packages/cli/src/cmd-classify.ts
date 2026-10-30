import path from "node:path";
import {
  classify,
  loadConfig,
  parseEnvMajor,
  readVersion,
  toVersionFiles,
} from "@policy-semver/core";
import type { GlobalFlags } from "./parse-args.js";

export async function cmdClassify(input: {
  flags: GlobalFlags;
  title?: string;
  commits: { subject: string; body?: string }[];
}): Promise<void> {
  const configPath = path.resolve(input.flags.cwd, input.flags.config);
  const config = await loadConfig(configPath);
  const files = toVersionFiles(config.versionFiles);
  const currentVersion = await readVersion({
    cwd: input.flags.cwd,
    files,
  });

  const envMajor = parseEnvMajor(config.majorEnv, process.env[config.majorEnv]);

  const result = classify({
    commits: input.commits,
    ...(input.title !== undefined ? { prTitle: input.title } : {}),
    currentVersion,
    envMajor,
  });

  console.log(
    input.flags.json ? JSON.stringify(result) : JSON.stringify(result, null, 2),
  );
}
