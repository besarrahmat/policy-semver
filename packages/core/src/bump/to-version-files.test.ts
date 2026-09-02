import { expect, it } from "vitest";
import { toVersionFiles } from "./to-version-files.js";

it("maps VERSION + first package.json as dual-source primary", () => {
  expect(toVersionFiles(["VERSION", "package.json"])).toEqual({
    versionFile: "VERSION",
    packageJson: "package.json",
  });
});

it("locksteps extra package.json paths after the first", () => {
  expect(
    toVersionFiles([
      "VERSION",
      "package.json",
      "packages/cli/package.json",
      "packages/core/package.json",
    ]),
  ).toEqual({
    versionFile: "VERSION",
    packageJson: "package.json",
    extraPackageJson: [
      "packages/cli/package.json",
      "packages/core/package.json",
    ],
  });
});

it("treats nested VERSION as the version file", () => {
  expect(toVersionFiles(["app/VERSION", "app/package.json"])).toEqual({
    versionFile: "app/VERSION",
    packageJson: "app/package.json",
  });
});
