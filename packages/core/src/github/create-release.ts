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

/** GitHub refuses a longer body, so a huge release could never finish on rerun. */
const MAX_RELEASE_BODY = 125_000;
const TRUNCATED_NOTE =
  "\n\n…truncated. The changelog at this tag has the rest.\n";

function fitReleaseBody(body: string): string {
  if (body.length <= MAX_RELEASE_BODY) return body;
  const room = body.slice(0, MAX_RELEASE_BODY - TRUNCATED_NOTE.length);
  return `${room.slice(0, room.lastIndexOf("\n"))}${TRUNCATED_NOTE}`;
}

function statusOf(err: unknown): number | undefined {
  return (err as { status?: number }).status;
}

export async function releaseExists(
  input: Pick<CreateReleaseInput, "owner" | "repo" | "tag" | "octokit">,
): Promise<boolean> {
  try {
    await input.octokit.repos.getReleaseByTag({
      owner: input.owner,
      repo: input.repo,
      tag: input.tag,
    });
    return true;
  } catch (err) {
    if (statusOf(err) !== 404) throw err;
    return false;
  }
}

/**
 * Create a GitHub Release. Body is redacted.
 * If a release for the tag already exists → fail (no overwrite).
 */
export async function createGitHubRelease(
  input: CreateReleaseInput,
): Promise<void> {
  const body = fitReleaseBody(redactSecrets(input.body));

  if (await releaseExists(input)) {
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
