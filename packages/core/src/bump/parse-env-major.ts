/**
 * Read the major-version env var. Unset or empty → no major requested.
 * Digits only: `parseInt("2abc")` is 2, so a typo would release a major.
 */
export function parseEnvMajor(
  name: string,
  raw: string | undefined,
): number | null {
  if (raw === undefined || raw === "") return null;
  if (!/^\d+$/.test(raw)) {
    throw new Error(`invalid ${name}=${JSON.stringify(raw)}`);
  }
  return Number(raw);
}
