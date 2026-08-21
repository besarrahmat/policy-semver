import type { ClassifyKind } from "../classify/locks.js";
import type { HOOK_NAMES } from "./locks.js";

export type HookName = (typeof HOOK_NAMES)[number];

export type HookExec = (
  command: string,
  opts: { cwd: string; env: NodeJS.ProcessEnv },
) => Promise<{ stdout: string; stderr: string }>;

export type RunHookInput = {
  name: HookName;
  command: string | null;
  cwd: string;
  version: string;
  kind: ClassifyKind;
  dryRun: boolean;
  exec?: HookExec;
};
