import { getOctokit } from "@actions/github";
import {
  type CreateReleaseInput,
  type RunReleaseInput,
  type RunReleaseResult,
  runRelease,
} from "@policy-semver/core";

export type ActionWriteReleaseInput = Omit<RunReleaseInput, "octokit"> & {
  /** `GITHUB_TOKEN` or PAT with contents:write (and push to protected branch) */
  token: string;
};

function toReposOctokit(token: string): CreateReleaseInput["octokit"] {
  const octokit = getOctokit(token);
  return {
    repos: {
      getReleaseByTag: (p) => octokit.rest.repos.getReleaseByTag(p),
      createRelease: (p) => octokit.rest.repos.createRelease(p),
    },
  };
}

/**
 * Action write-path: commit → tag → push → GitHub Release.
 * Call only after VERSION / package.json / CHANGELOG are already written.
 * kind `none` is short-circuited inside `runRelease`.
 */
export async function runWriteRelease(
  input: ActionWriteReleaseInput,
): Promise<RunReleaseResult> {
  const { token, ...rest } = input;
  return runRelease({
    ...rest,
    octokit: toReposOctokit(token),
  });
}
