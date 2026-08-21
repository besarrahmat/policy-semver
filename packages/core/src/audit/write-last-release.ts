import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { AUDIT_DIR, AUDIT_FILE } from "./locks.js";
import type { LastReleaseRecord, WriteLastReleaseInput } from "./types.js";

export function lastReleaseRelPath(): string {
  return `${AUDIT_DIR}/${AUDIT_FILE}`;
}

export function lastReleasePath(cwd: string): string {
  return path.join(cwd, AUDIT_DIR, AUDIT_FILE);
}

export async function writeLastRelease(
  input: WriteLastReleaseInput,
): Promise<LastReleaseRecord> {
  const record: LastReleaseRecord = {
    version: input.version,
    kind: input.kind,
    gitSha: input.gitSha,
    tag: input.tag,
    at: input.at ?? new Date().toISOString(),
  };
  await mkdir(path.join(input.cwd, AUDIT_DIR), { recursive: true });
  await writeFile(
    lastReleasePath(input.cwd),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  return record;
}
