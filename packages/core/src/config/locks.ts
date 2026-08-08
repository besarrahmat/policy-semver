/**
 * Validator: **Ajv** (runtime dep of `@policy-semver/core` only).
 * JSON Schema dialect: **draft-07**
 *   `$schema`: `http://json-schema.org/draft-07/schema#`
 *   Use `import { Ajv } from "ajv"` (named export — required under NodeNext).
 *
 * Fail-closed unknown keys: `"additionalProperties": false` on root + nested
 * objects in the schema. Validation failure → throw; never warn-and-continue.
 *
 * Module boundary: parse + validate only — must not bump git, call
 * GitHub, or write VERSION / package.json.
 */
export const CONFIG_VALIDATOR = "ajv" as const;
export const CONFIG_SCHEMA_DIALECT = "draft-07" as const;
export const CONFIG_SCHEMA_URI =
  "http://json-schema.org/draft-07/schema#" as const;
