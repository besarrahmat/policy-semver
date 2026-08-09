import path from "node:path";
import {
  applyBump,
  classify,
  loadConfig,
  readVersion,
  writeVersion,
} from "@policy-semver/core";
import { EXIT_OK, EXIT_POLICY, EXIT_USAGE } from "./exit.js";
import { isGitClean } from "./git-clean.js";
import type { GlobalFlags } from "./parse-args.js";
import { toVersionFiles } from "./version-files.js";

export async function cmdBump(input: {
  flags: GlobalFlags;
  dryRun: boolean;
  write: boolean;
  force: boolean;
  commits: { subject: string; body?: string }[];
}): Promise<number> {
  if (input.dryRun === input.write) {
    console.error("bump requires exactly one of --dry-run or --write");
    return EXIT_USAGE;
  }

  if (input.write && !input.force && !(await isGitClean(input.flags.cwd))) {
    console.error("refusing --write on dirty tree (use --force to override)");
    return EXIT_POLICY;
  }

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

  const { kind, warnings } = classify({
    commits: input.commits,
    currentVersion,
    envMajor,
  });
  const nextVersion = applyBump({ kind, currentVersion, envMajor });

  const payload = {
    kind,
    currentVersion,
    nextVersion,
    warnings,
    dryRun: input.dryRun,
    wrote: false as boolean,
  };

  if (input.write) {
    const result = await writeVersion({
      cwd: input.flags.cwd,
      nextVersion,
      dryRun: false,
      allowWrite: true,
      files,
    });
    payload.wrote = result.wrote;
  }

  console.log(
    input.flags.json
      ? JSON.stringify(payload)
      : JSON.stringify(payload, null, 2),
  );
  return EXIT_OK;
}
