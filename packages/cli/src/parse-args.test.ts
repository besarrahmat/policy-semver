import { describe, expect, it } from "vitest";
import { parseArgs } from "./parse-args.js";

describe("parseArgs", () => {
  it("strips literal --", () => {
    expect(parseArgs(["node", "bin", "--", "--help"]).command).toBe("help");
  });

  it("--config / --cwd / --title require values", () => {
    expect(() => parseArgs(["node", "bin", "classify", "--config"])).toThrow(
      /--config requires a value/,
    );
    expect(() =>
      parseArgs(["node", "bin", "classify", "--config", "--json"]),
    ).toThrow(/--config requires a value/);
    expect(() =>
      parseArgs(["node", "bin", "classify", "--title", "--json"]),
    ).toThrow(/--title requires a value/);
  });

  it("parses bump flags", () => {
    const p = parseArgs([
      "node",
      "bin",
      "bump",
      "--dry-run",
      "--json",
      "--cwd",
      "/tmp/x",
    ]);
    expect(p).toMatchObject({
      command: "bump",
      dryRun: true,
      write: false,
      flags: { json: true, cwd: "/tmp/x" },
    });
  });
});
