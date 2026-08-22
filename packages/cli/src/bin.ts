import { cmdBump } from "./cmd-bump.js";
import { cmdClassify } from "./cmd-classify.js";
import { printHelp } from "./cmd-help.js";
import { cmdTest } from "./cmd-test.js";
import { cmdVerify } from "./cmd-verify.js";
import { EXIT_OK, EXIT_POLICY, EXIT_USAGE } from "./exit.js";
import { loadCommits } from "./load-commits.js";
import { parseArgs } from "./parse-args.js";

async function main(): Promise<number> {
  try {
    const parsed = parseArgs(process.argv);
    switch (parsed.command) {
      case "help": {
        printHelp();
        return EXIT_OK;
      }
      case "classify": {
        const commits = await loadCommits(parsed.flags.cwd);
        await cmdClassify({
          flags: parsed.flags,
          commits,
          ...(parsed.title !== undefined ? { title: parsed.title } : {}),
        });
        return EXIT_OK;
      }
      case "bump": {
        const commits = await loadCommits(parsed.flags.cwd);
        return await cmdBump({
          flags: parsed.flags,
          dryRun: parsed.dryRun,
          write: parsed.write,
          force: parsed.force,
          commits,
        });
      }
      case "verify": {
        return await cmdVerify({ flags: parsed.flags });
      }
      case "test": {
        return await cmdTest({ flags: parsed.flags });
      }
    }
  } catch (err) {
    const usage = Boolean((err as { usage?: boolean }).usage);
    console.error(err instanceof Error ? err.message : String(err));
    return usage ? EXIT_USAGE : EXIT_POLICY;
  }
}

const code = await main();
process.exit(code);
