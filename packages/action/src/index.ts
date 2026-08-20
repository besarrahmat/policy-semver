import * as core from "@actions/core";
import { runAction } from "./run-action.js";

export {
  ACTION_ADAPTER,
  ACTION_BUNDLE,
  ACTION_COMMENT,
  ACTION_EVENT,
  ACTION_LAYOUT,
  ACTION_RUNTIME,
  ACTION_VERSIONING,
} from "./locks.js";
export { runAction } from "./run-action.js";
export {
  type ActionWriteReleaseInput,
  runWriteRelease,
} from "./write-release.js";

/** @deprecated use runAction */
export async function run(): Promise<void> {
  await runAction();
}

// ncc entry: only when GitHub Actions executes the bundle
if (process.env.GITHUB_ACTIONS === "true") {
  runAction().catch((err) => {
    core.setFailed(err instanceof Error ? err.message : String(err));
  });
}
