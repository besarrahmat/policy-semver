export type GitExec = (
  args: string[],
  opts?: { cwd: string },
) => Promise<{ stdout: string; stderr: string }>;

export type CommitBumpInput = {
  cwd: string;
  message: string; // from formatBotBumpCommitMessage
  paths: string[]; // VERSION, package.json, CHANGELOG.md, …
  exec?: GitExec;
};

export type TagInput = {
  cwd: string;
  tag: string; // tagPrefix + version
  message: string; // annotated message
  exec?: GitExec;
};

export type PushInput = {
  cwd: string;
  refs: string[]; // e.g. ["HEAD", "v1.2.3"] or branch + tag
  remote?: string; // default "origin"
  exec?: GitExec;
};
