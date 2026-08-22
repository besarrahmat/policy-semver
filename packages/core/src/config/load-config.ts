import { readFile } from "node:fs/promises";
import type { ValidateFunction } from "ajv";
import { Ajv } from "ajv";
import type { VersioningConfig } from "./types.js";
import schema from "./versioning.config.schema.json" with { type: "json" };

/**
 * Schema shipping:
 * Embed `versioning.config.schema.json` beside this module and import it as JSON.
 * Runtime never reads monorepo-root `schemas/` (that copy is canonical — keep
 * both files in sync with `cp` + empty `diff` after every schema edit).
 */
const ajv = new Ajv({
  allErrors: true,
  useDefaults: true,
});

const validate = ajv.compile(schema) as ValidateFunction<VersioningConfig>;

export async function loadConfig(path: string): Promise<VersioningConfig> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`versioning config not found: ${path}`);
    }
    throw err;
  }

  let data: unknown;
  try {
    data = JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`versioning config is not valid JSON: ${path}`);
  }

  if (!validate(data)) {
    throw new Error(
      `invalid versioning config (${path}): ${ajv.errorsText(validate.errors, { separator: "; " })}`,
    );
  }

  return data;
}
