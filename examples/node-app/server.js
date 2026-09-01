import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const fromFile = readFileSync(join(root, "VERSION"), "utf8").trim();
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
if (typeof pkg.version !== "string" || pkg.version !== fromFile) {
  throw new Error(
    `VERSION ${JSON.stringify(fromFile)} != package.json ${JSON.stringify(pkg.version)}`,
  );
}

/** Baked at process start from the deploy artifact — not fetched from a CDN. */
const version = fromFile;
console.log(`policy-semver-example-node-app ${version}`);

const port = Number(process.env.PORT) || 3000;
const server = createServer((req, res) => {
  const pathName =
    req.url === undefined ? "/" : new URL(req.url, "http://127.0.0.1").pathname;
  if (pathName !== "/" && pathName !== "/version") {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("not found\n");
    return;
  }
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(`${version}\n`);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`listening on 127.0.0.1:${port}`);
});
