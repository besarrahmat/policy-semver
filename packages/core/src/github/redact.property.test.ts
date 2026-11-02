import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { redactSecrets } from "./redact.js";

fc.configureGlobal({ numRuns: Number(process.env.FC_NUM_RUNS) || 100 });

const alnum = (min: number) =>
  fc.stringMatching(new RegExp(`^[A-Za-z0-9]{${min},40}$`));
const secret = fc.oneof(
  alnum(36).map((s) => `ghp_${s}`),
  alnum(36).map((s) => `ghs_${s}`),
  alnum(30).map((s) => `github_pat_${s}_${s}`),
  alnum(36).map((s) => `npm_${s}`),
  fc.stringMatching(/^[0-9A-Z]{16}$/).map((s) => `AKIA${s}`),
  alnum(20).map((s) => `xoxb-${s}`),
  alnum(30).map((s) => `sk-ant-${s}`),
  alnum(20).map((s) => `eyJ${s}.${s}.${s}`),
  alnum(24).map((s) => `glpat-${s}`),
  alnum(32).map((s) => `sk-proj-${s}`),
);
const around = fc.constantFrom(
  " ",
  "\n",
  "=",
  '"',
  "'",
  ":",
  "(",
  ")",
  ",",
  "/",
);

describe("redactSecrets invariants (I6)", () => {
  it("no token survives, whatever punctuation surrounds it", () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 10 }),
        around,
        secret,
        around,
        (text, l, s, r) => {
          expect(redactSecrets(`${text}${l}${s}${r}${text}`)).not.toContain(s);
        },
      ),
    );
  });

  it("credentials in a remote URL do not survive", () => {
    fc.assert(
      fc.property(alnum(8), alnum(20), (user, pass) => {
        const out = redactSecrets(
          `fatal: https://${user}:${pass}@github.com/o/r`,
        );
        expect(out).not.toContain(pass);
        expect(out).toContain("github.com/o/r");
      }),
    );
  });

  it("is idempotent", () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 40 }), (text) => {
        const once = redactSecrets(text);
        expect(redactSecrets(once)).toBe(once);
      }),
    );
  });

  it("leaves ordinary changelog prose alone", () => {
    for (const prose of [
      "- Fixed Basic authentication",
      "- Bearer tokens are documented",
      "- See https://github.com/o/r/pull/1",
      "- Bump eslint from 8.0.0 to 9.0.0",
    ]) {
      expect(redactSecrets(prose)).toBe(prose);
    }
  });
});
