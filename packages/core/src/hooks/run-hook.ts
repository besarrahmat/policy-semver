import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { HOOK_ENV, HOOK_SHELL } from "./locks.js";
import type { HookExec, RunHookInput } from "./types.js";

const execFileAsync = promisify(execFile);

/** A stuck hook must fail the job, not hold the release queue open. */
const HOOK_TIMEOUT_MS = 10 * 60 * 1000;
const HOOK_MAX_BUFFER_BYTES = 50 * 1024 * 1024;
/** Hook commands come from config; they get no ambient write token. */
const HOOK_ENV_DENYLIST = ["POLICY_SEMVER_TOKEN", "INPUT_TOKEN"];

export const defaultHookExec: HookExec = async (command, opts) => {
  const { stdout, stderr } = await execFileAsync(HOOK_SHELL, ["-c", command], {
    cwd: opts.cwd,
    env: opts.env,
    encoding: "utf8",
    maxBuffer: HOOK_MAX_BUFFER_BYTES,
    timeout: HOOK_TIMEOUT_MS,
  });
  return { stdout: String(stdout), stderr: String(stderr) };
};

export function hookEnvVars(input: {
  version: string;
  kind: string;
  dryRun: boolean;
}): NodeJS.ProcessEnv {
  return {
    [HOOK_ENV.version]: input.version,
    [HOOK_ENV.kind]: input.kind,
    [HOOK_ENV.dryRun]: input.dryRun ? "true" : "false",
  };
}

/**
 * Skip on `null` / omitted / blank. Non-zero `sh -c` → throw (abort caller).
 * Does not write files or touch git.
 */
export async function runHook(input: RunHookInput): Promise<void> {
  if (input.command == null || input.command.trim() === "") {
    return;
  }

  const exec = input.exec ?? defaultHookExec;
  const inherited = { ...process.env };
  for (const name of HOOK_ENV_DENYLIST) delete inherited[name];
  const env: NodeJS.ProcessEnv = {
    ...inherited,
    ...hookEnvVars({
      version: input.version,
      kind: input.kind,
      dryRun: input.dryRun,
    }),
  };

  try {
    const { stdout, stderr } = await exec(input.command, {
      cwd: input.cwd,
      env,
    });
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  } catch (err) {
    const code = (err as { code?: number | string }).code ?? "unknown";
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`hook ${input.name} failed (exit ${code}): ${detail}`);
  }
}
