import { redactSecrets } from "@policy-semver/core";

export function writeFailureMessage(err: unknown): string {
  const msg = redactSecrets(err instanceof Error ? err.message : String(err));
  const pushDenied =
    /protected branch|GH006|not allowed to push|permission.*denied/i.test(msg);
  const hint = pushDenied
    ? " If branch protection blocks github-actions, set `token` on actions/checkout to a PAT or GitHub App token with contents:write bypass (git push uses the checkout's credentials)."
    : "";
  return `Write/push/release failed: ${msg}.${hint} Rerunning this job is safe: it finishes the release without a second bump.`;
}
