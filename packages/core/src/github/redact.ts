import { SECRET_REDACT_PATTERNS, SECRET_REDACT_REPLACEMENT } from "./locks.js";

/** Never log the pre-redact string that matched a secret pattern. */
export function redactSecrets(text: string): string {
  let out = text;
  for (const re of SECRET_REDACT_PATTERNS) {
    out = out.replace(re, SECRET_REDACT_REPLACEMENT);
  }
  return out;
}
