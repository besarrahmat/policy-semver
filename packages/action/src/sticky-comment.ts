import type { getOctokit } from "@actions/github";
import { ACTION_COMMENT } from "./locks.js";

type Octokit = ReturnType<typeof getOctokit>;

export async function upsertStickyComment(input: {
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}): Promise<void> {
  const marker = ACTION_COMMENT.marker;
  const body = `${marker}\n${input.body}`;
  const { data: comments } = await input.octokit.rest.issues.listComments({
    owner: input.owner,
    repo: input.repo,
    issue_number: input.issueNumber,
    per_page: 100,
  });
  const existing = comments.find((c) => c.body?.includes(marker));
  if (existing) {
    await input.octokit.rest.issues.updateComment({
      owner: input.owner,
      repo: input.repo,
      comment_id: existing.id,
      body,
    });
    return;
  }
  await input.octokit.rest.issues.createComment({
    owner: input.owner,
    repo: input.repo,
    issue_number: input.issueNumber,
    body,
  });
}
