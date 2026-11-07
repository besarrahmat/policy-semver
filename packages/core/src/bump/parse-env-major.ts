/**
 * Read the major-version env var. Unset or empty → no major requested.
 * Digits only: `parseInt("2abc")` is 2, so a typo would release a major.
 */
export function parseEnvMajor(
  name: string,
  raw: string | undefined,
): number | null {
  if (raw === undefined || raw === "") return null;
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw))) {
    // Not the value: config picks `name`, so it could be any variable, even a secret.
    throw new Error(`invalid ${name}: expected digits only`);
  }
  return Number(raw);
}
