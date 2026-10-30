import { defineConfig, type Options } from "tsup";

const shared: Options = {
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: false,
  splitting: false,
  // .d.ts comes from `tsc -p tsconfig.build.json`: tsup dts (rollup-plugin-dts) needs the TS JS API, gone in TS 7.
};

export default defineConfig([
  {
    ...shared,
    entry: { bin: "src/bin.ts" },
    banner: { js: "#!/usr/bin/env node\n" },
  },
  {
    ...shared,
    entry: { index: "src/index.ts" },
  },
]);
