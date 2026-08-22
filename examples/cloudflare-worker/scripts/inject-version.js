import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const version = readFileSync(join(root, "VERSION"), "utf8").trim();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (typeof pkg.version !== "string" || pkg.version !== version) {
  throw new Error(
    `VERSION ${JSON.stringify(version)} != package.json ${JSON.stringify(pkg.version)}`,
  );
}
writeFileSync(
  join(root, "src/version.js"),
  `/** Generated from VERSION at build. Do not fetch this from a CDN. */\nexport const APP_VERSION = ${JSON.stringify(version)};\n`,
);
