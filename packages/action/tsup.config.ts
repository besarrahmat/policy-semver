import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    format: ["cjs"],
    platform: "node",
    target: "node24",
    outDir: "../../dist",
    // packages/action is "type": "module" → default CJS name is index.cjs
    outExtension: () => ({ js: ".js" }),
    sourcemap: false,
    clean: true,
    splitting: false,
    dts: false,
    // Runner never npm-installs Action deps — bundle core + @actions/*
    noExternal: [/.*/],
});