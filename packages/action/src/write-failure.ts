import { redactSecrets } from "@policy-semver/core";

const VERSION_BEHIND_TAGS = /tag already exists|mirror tag conflict/;
/** Causes in the repo itself: a rerun meets them again until a human acts. */
const NEEDS_A_FIX =
  /conflict markers|higher major|ignored by one of your \.gitignore|points at|has no section|is missing on the remote/;

function nextStep(msg: string): string {
  if (VERSION_BEHIND_TAGS.test(msg)) {
    return "The version files are behind the tags, often after a reverted bump commit. Raise them to the latest released version; a rerun fails the same way until then.";
  }
  if (NEEDS_A_FIX.test(msg)) {
    return "A rerun fails the same way until this is fixed.";
  }
  return "Rerunning this job is safe: it finishes the release without a second bump.";
}

export function writeFailureMessage(err: unknown): string {
  const msg = redactSecrets(err instanceof Error ? err.message : String(err));
  const pushDenied =
    /protected branch|GH006|not allowed to push|permission.*denied/i.test(msg);
  const hint = pushDenied
    ? " If branch protection blocks github-actions, set `token` on actions/checkout to a PAT or GitHub App token with contents:write bypass (git push uses the checkout's credentials)."
    : "";
  return `Write/push/release failed: ${msg}.${hint} ${nextStep(msg)}`;
}
