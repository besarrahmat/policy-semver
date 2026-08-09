import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  splitting: false,
  dts: false,
  // Required: @policy-semver/core exports .ts source today
  noExternal: ["@policy-semver/core"],
  // Survive strip of source shebang; matches CLI_BUILD.shebangBanner
  banner: {
    js: "#!/usr/bin/env node\n",
  },
});
