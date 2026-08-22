import { TAG_EXISTS_FAILS } from "./locks.js";
import { redactSecrets } from "./redact.js";

export type CreateReleaseInput = {
  owner: string;
  repo: string;
  tag: string;
  name?: string;
  /** Changelog section markdown — redact before send */
  body: string;
  targetCommitish?: string;
  /** Minimal Octokit surface */
  octokit: {
    repos: {
      getReleaseByTag: (p: {
        owner: string;
        repo: string;
        tag: string;
      }) => Promise<unknown>;
      createRelease: (p: {
        owner: string;
        repo: string;
        tag_name: string;
        name: string;
        body: string;
        target_commitish?: string;
      }) => Promise<unknown>;
    };
  };
};

function statusOf(err: unknown): number | undefined {
  return (err as { status?: number }).status;
}

/**
 * Create a GitHub Release. Body is redacted.
 * If a release for the tag already exists → fail (no overwrite).
 */
export async function createGitHubRelease(
  input: CreateReleaseInput,
): Promise<void> {
  const body = redactSecrets(input.body);

  let releaseExists = false;
  try {
    await input.octokit.repos.getReleaseByTag({
      owner: input.owner,
      repo: input.repo,
      tag: input.tag,
    });
    releaseExists = true;
  } catch (err) {
    if (statusOf(err) !== 404) throw err;
  }

  if (releaseExists && TAG_EXISTS_FAILS) {
    throw new Error(`release already published: ${input.tag}`);
  }

  await input.octokit.repos.createRelease({
    owner: input.owner,
    repo: input.repo,
    tag_name: input.tag,
    name: input.name ?? input.tag,
    body,
    ...(input.targetCommitish !== undefined
      ? { target_commitish: input.targetCommitish }
      : {}),
  });
}
