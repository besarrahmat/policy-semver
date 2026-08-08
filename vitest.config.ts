import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const monorepoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: monorepoRoot,
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
