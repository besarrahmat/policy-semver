import path from "node:path";
import { classify, loadConfig, readVersion } from "@policy-semver/core";
import type { GlobalFlags } from "./parse-args.js";
import { toVersionFiles } from "./version-files.js";

export async function cmdClassify(input: {
  flags: GlobalFlags;
  title?: string;
  commits: { subject: string; body?: string }[];
}): Promise<void> {
  const configPath = path.join(input.flags.cwd, input.flags.config);
  const config = await loadConfig(configPath);
  const files = toVersionFiles(config.versionFiles);
  const currentVersion = await readVersion({
    cwd: input.flags.cwd,
    files,
  });

  const envRaw = process.env[config.majorEnv];
  let envMajor: number | null = null;
  if (envRaw !== undefined && envRaw !== "") {
    envMajor = Number.parseInt(envRaw, 10);
    if (Number.isNaN(envMajor)) {
      throw new Error(`invalid ${config.majorEnv}=${JSON.stringify(envRaw)}`);
    }
  }

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
