import { Octokit } from "@octokit/rest";
import {
  type CreateReleaseInput,
  type RunReleaseInput,
  type RunReleaseResult,
  runRelease,
} from "@policy-semver/core";

export type CliWriteReleaseInput = Omit<RunReleaseInput, "octokit"> & {
  /** PAT / token with contents:write if pushing to protected branch */
  token: string;
};

function toReposOctokit(token: string): CreateReleaseInput["octokit"] {
  const octokit = new Octokit({ auth: token });
  return {
    repos: {
      getReleaseByTag: (p) => octokit.repos.getReleaseByTag(p),
      createRelease: (p) => octokit.repos.createRelease(p),
    },
  };
}

/**
 * CLI write-path wiring for release (same orchestrator as Action).
 * Full CLI command surface lands later — this exports the release step.
 */
export async function runWriteRelease(
  input: CliWriteReleaseInput,
): Promise<RunReleaseResult> {
  const { token, ...rest } = input;
  return runRelease({
    ...rest,
    octokit: toReposOctokit(token),
  });
}
