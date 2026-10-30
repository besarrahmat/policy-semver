import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node24",
  sourcemap: true,
  clean: true,
  splitting: false,
  // .d.ts comes from `tsc -p tsconfig.build.json`: tsup dts (rollup-plugin-dts) needs the TS JS API, gone in TS 7.
});
