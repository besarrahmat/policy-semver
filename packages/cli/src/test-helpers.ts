import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const MIN_CONFIG = {
  schemaVersion: "1",
  prodBranch: "main",
  developBranch: "dev",
  majorEnv: "APP_VERSION_MAJOR",
  versionFiles: ["VERSION", "package.json"],
  changelogPath: "CHANGELOG.md",
  tagPrefix: "v",
  skipLabels: ["skip-version"],
  skipTrailers: ["skip version"],
  hooks: { beforeBump: null, afterTag: null, afterRelease: null },
} as const;

export async function makeTempApp(opts?: {
  version?: string;
  packageVersion?: string;
  config?: Record<string, unknown>;
  initGit?: boolean;
}): Promise<string> {
  const cwd = await mkdtemp(path.join(tmpdir(), "ps-cli-"));
  const version = opts?.version ?? "1.0.0";
  const pkgVer = opts?.packageVersion ?? version;
  await writeFile(
    path.join(cwd, "versioning.config.json"),
    `${JSON.stringify(opts?.config ?? MIN_CONFIG, null, 2)}\n`,
  );
  await writeFile(path.join(cwd, "VERSION"), `${version}\n`);
  await writeFile(
    path.join(cwd, "package.json"),
    `${JSON.stringify({ name: "app", version: pkgVer }, null, 2)}\n`,
  );
  if (opts?.initGit) {
    await execFileAsync("git", ["init"], { cwd });
    await execFileAsync("git", ["config", "user.email", "t@t.test"], { cwd });
    await execFileAsync("git", ["config", "user.name", "t"], { cwd });
    await execFileAsync("git", ["config", "commit.gpgsign", "false"], { cwd });
    await execFileAsync("git", ["add", "-A"], { cwd });
    await execFileAsync(
      "git",
      ["-c", "commit.gpgsign=false", "commit", "--no-gpg-sign", "-m", "init"],
      { cwd },
    );
  }
  return cwd;
}
