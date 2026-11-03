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

it.each(["manifest.json", "my-package.json", "sub/version.txt"])(
  "rejects %s instead of dropping it",
  (entry) => {
    expect(() => toVersionFiles(["VERSION", entry])).toThrow(
      /unsupported versionFiles entry/,
    );
  },
);

it("rejects a second VERSION file", () => {
  expect(() => toVersionFiles(["VERSION", "sub/VERSION"])).toThrow(
    /one VERSION file/,
  );
});

it.each(["VERSION.bak", "package.json.bak"])(
  "rejects %s instead of treating it as a version file",
  (entry) => {
    expect(() => toVersionFiles([entry])).toThrow(/unsupported versionFiles/);
  },
);

it("leaves out what is not configured", () => {
  expect(toVersionFiles(["VERSION"])).toStrictEqual({ versionFile: "VERSION" });
  expect(toVersionFiles(["package.json"])).toStrictEqual({
    packageJson: "package.json",
  });
});
