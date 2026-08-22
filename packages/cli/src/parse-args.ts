export type GlobalFlags = {
  config: string;
  cwd: string;
  json: boolean;
};

export type ParsedCli =
  | { command: "help" }
  | { command: "classify"; flags: GlobalFlags; title?: string }
  | {
      command: "bump";
      flags: GlobalFlags;
      dryRun: boolean;
      write: boolean;
      force: boolean;
    }
  | { command: "verify"; flags: GlobalFlags }
  | { command: "test"; flags: GlobalFlags };

function takeValue(rest: string[], i: number, flag: string): string {
  const v = rest[i + 1];
  if (v === undefined || v.startsWith("-")) {
    throw Object.assign(new Error(`${flag} requires a value`), { usage: true });
  }
  return v;
}

export function parseArgs(argv: string[]): ParsedCli {
  // Drop POSIX end-of-options markers so `node dist/bin.js -- --help` works
  // when pnpm forwards a literal `--`.
  const args = argv.slice(2).filter((a) => a !== "--");
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return { command: "help" };
  }
  const command = args[0];
  const rest = args.slice(1);
  const flags: GlobalFlags = {
    config: "versioning.config.json",
    cwd: process.cwd(),
    json: false,
  };
  let title: string | undefined;
  let dryRun = false;
  let write = false;
  let force = false;

  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === "--json") flags.json = true;
    else if (a === "--config") {
      flags.config = takeValue(rest, i, "--config");
      i++;
    } else if (a === "--cwd") {
      flags.cwd = takeValue(rest, i, "--cwd");
      i++;
    } else if (a === "--title") {
      title = takeValue(rest, i, "--title");
      i++;
    } else if (a === "--dry-run") dryRun = true;
    else if (a === "--write") write = true;
    else if (a === "--force") force = true;
    else if (a === "--help" || a === "-h") return { command: "help" };
    else throw Object.assign(new Error(`unknown flag: ${a}`), { usage: true });
  }

  if (command === "classify")
    return {
      command: "classify",
      flags,
      ...(title !== undefined ? { title } : {}),
    };
  if (command === "bump")
    return { command: "bump", flags, dryRun, write, force };
  if (command === "verify") return { command: "verify", flags };
  if (command === "test") return { command: "test", flags };
  if (command === "help") return { command: "help" };
  throw Object.assign(new Error(`unknown command: ${command}`), {
    usage: true,
  });
}
