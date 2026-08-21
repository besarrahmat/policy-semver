import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const yaml = readFileSync(
  path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    "../examples/consumer.yml",
  ),
  "utf8",
);

it("serialize on prod base and never cancel in progress", () => {
  expect(yaml).toMatch(/concurrency:/);
  expect(yaml).toMatch(/cancel-in-progress:\s*false/);
  expect(yaml).toMatch(/fetch-depth:\s*0/);
  expect(yaml).toMatch(/github\.event\.pull_request\.base\.ref/);
  expect(yaml).not.toMatch(/\$\{\{\s*github\.ref\s*\}\}/); // refs/pull/N/merge
});

it("bump then build then deploy via needs", () => {
  expect(yaml).toMatch(/^\s+needs:\s*version\s*$/m);
  expect(yaml).toMatch(/^\s+needs:\s*build\s*$/m);
  expect(yaml).toMatch(
    /needs:\s*version[\s\S]*merged == true[\s\S]*needs:\s*build/m,
  );
  expect(yaml).toMatch(/inject VERSION into the build/);
});
