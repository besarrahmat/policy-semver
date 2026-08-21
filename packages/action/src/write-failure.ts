export function writeFailureMessage(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  const pushDenied =
    /protected branch|GH006|not allowed to push|permission.*denied/i.test(msg);
  const hint = pushDenied
    ? " If branch protection blocks github-actions, use POLICY_SEMVER_TOKEN (PAT) or a GitHub App with contents:write bypass."
    : "";
  return `Write/push/release failed: ${msg}.${hint}`;
}
