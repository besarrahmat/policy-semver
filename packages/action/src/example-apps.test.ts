import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadConfig } from "@policy-semver/core";
import { expect, it } from "vitest";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function pkgVersion(rel: string): string {
  const pkg = JSON.parse(read(rel)) as { version?: unknown };
  if (typeof pkg.version !== "string") {
    throw new Error(`missing version in ${rel}`);
  }
  return pkg.version;
}

it("examples are not pnpm workspace members", () => {
  const ws = read("pnpm-workspace.yaml");
  expect(ws).toMatch(/^\s+-\s+"packages\/\*"/m);
  expect(ws).not.toMatch(/^\s+-\s+"examples/m);
});

it("node-app dual-source + workflow + displayed version", () => {
  const dir = "examples/node-app";
  expect(existsSync(path.join(root, dir, "package.json"))).toBe(true);
  expect(existsSync(path.join(root, dir, "VERSION"))).toBe(true);
  expect(existsSync(path.join(root, dir, "versioning.config.json"))).toBe(true);
  expect(
    existsSync(path.join(root, dir, ".github/workflows/policy-semver.yml")),
  ).toBe(true);
  const version = read(`${dir}/VERSION`).trim();
  expect(pkgVersion(`${dir}/package.json`)).toBe(version);
  const server = read(`${dir}/server.js`);
  expect(server).toMatch(/readFileSync\(join\(root, "VERSION"\)/);
  expect(server).toMatch(/console\.log/);
  expect(server).toMatch(/createServer/);
});

it("cloudflare-worker injects VERSION at build (not CDN)", () => {
  const dir = "examples/cloudflare-worker";
  execFileSync(process.execPath, ["scripts/inject-version.js"], {
    cwd: path.join(root, dir),
  });
  const version = read(`${dir}/VERSION`).trim();
  expect(pkgVersion(`${dir}/package.json`)).toBe(version);
  expect(read(`${dir}/src/version.js`)).toContain(JSON.stringify(version));
  expect(read(`${dir}/src/worker.js`)).toMatch(/APP_VERSION/);
  const readme = read(`${dir}/README.md`);
  expect(readme).toMatch(/inject-version/);
  expect(readme).toMatch(/CDN/);
  expect(readme).toMatch(/--define/);
  expect(
    existsSync(path.join(root, dir, ".github/workflows/policy-semver.yml")),
  ).toBe(true);
  expect(existsSync(path.join(root, dir, "wrangler.jsonc"))).toBe(true);
});

it("each example README has workspace classify and npx after publish", () => {
  for (const dir of ["examples/node-app", "examples/cloudflare-worker"]) {
    const readme = read(`${dir}/README.md`);
    expect(readme).toMatch(/pnpm policy-semver classify --cwd/);
    expect(readme).toMatch(/npx policy-semver@0\.1\.0 classify/);
    expect(readme).toMatch(/404s from another private repo/);
    expect(readme).not.toMatch(/IMPLEMENTATION-PLAN/);
    expect(readme).not.toMatch(/VE-STATUS/);
  }
  const index = read("examples/README.md");
  expect(index).toMatch(/A second consumer app/);
  expect(index).toMatch(/npx policy-semver@0\.1\.0 classify/);
  expect(index).toMatch(/Ranked classifier fixtures/);
  expect(index).toMatch(/<full-commit-sha>/);
});

it("example versioning.config.json files load", async () => {
  for (const dir of ["examples/node-app", "examples/cloudflare-worker"]) {
    const config = await loadConfig(
      path.join(root, dir, "versioning.config.json"),
    );
    expect(config.schemaVersion).toBe("1");
    expect(config.prodBranch).toBe("main");
  }
});
