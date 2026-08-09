import { EXIT_OK } from "./exit.js";
import type { GlobalFlags } from "./parse-args.js";

/**
 * Golden fixtures skeleton — full suite in later phases.
 */
export async function cmdTest(_input: { flags: GlobalFlags }): Promise<number> {
  const payload = {
    ok: true,
    fixtures: "not implemented yet (later phases)",
  };
  console.log(
    _input.flags.json
      ? JSON.stringify(payload)
      : JSON.stringify(payload, null, 2),
  );
  return EXIT_OK;
}
