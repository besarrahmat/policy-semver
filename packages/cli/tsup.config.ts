import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: false,
  splitting: false,
};

export default defineConfig([
  {
    ...shared,
    entry: { bin: "src/bin.ts" },
    dts: false,
    banner: { js: "#!/usr/bin/env node\n" },
  },
  {
    ...shared,
    entry: { index: "src/index.ts" },
    dts: true,
  },
]);
