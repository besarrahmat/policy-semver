import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const monorepoRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: monorepoRoot,
  // Test the source: a stale `dist` would hide a core change from Action tests.
  resolve: {
    alias: {
      "@policy-semver/core": path.join(
        monorepoRoot,
        "packages/core/src/index.ts",
      ),
    },
  },
  test: {
    include: ["packages/*/src/**/*.test.ts"],
  },
});
