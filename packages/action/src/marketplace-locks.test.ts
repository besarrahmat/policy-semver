import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { ACTION_LAYOUT } from "./locks.js";
import {
  MARKETPLACE_BRANDING_COLORS,
  MARKETPLACE_CATEGORIES,
  MARKETPLACE_DOCS,
  MARKETPLACE_LISTING,
  MARKETPLACE_METADATA,
  MARKETPLACE_OPERATOR,
} from "./marketplace-locks.js";

const root = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(rel: string): string {
  return readFileSync(path.join(root, rel), "utf8");
}

function field(yml: string, key: string): string {
  const value = yml.match(new RegExp(`^${key}:\\s*(.+)$`, "m"))?.[1];
  if (!value) {
    throw new Error(`missing ${key}`);
  }
  return value.trim();
}

function indented(yml: string, key: string): string {
  const value = yml.match(new RegExp(`^\\s+${key}:\\s*(.+)$`, "m"))?.[1];
  if (!value) {
    throw new Error(`missing ${key}`);
  }
  return value.trim();
}

it("locks layout A, unique name, branding, live listing", () => {
  expect(ACTION_LAYOUT.id).toBe("A");
  expect(ACTION_LAYOUT.marketplaceRequired).toBe(true);
  expect(ACTION_LAYOUT.actionYmlPath).toBe("action.yml");
  expect(MARKETPLACE_METADATA.filename).toBe("action.yml");
  expect(MARKETPLACE_METADATA.doNotRenameToActionYaml).toBe(true);
  expect(MARKETPLACE_METADATA.name).toBe("PolicySemVer");
  expect(MARKETPLACE_METADATA.description).toMatch(/deployed apps/);
  expect(MARKETPLACE_METADATA.description).toMatch(/APP_VERSION_MAJOR/);
  expect(MARKETPLACE_METADATA.description.length).toBeLessThanOrEqual(
    MARKETPLACE_METADATA.maxDescriptionChars,
  );
  expect(MARKETPLACE_METADATA.branding.icon).toBe("tag");
  expect(MARKETPLACE_METADATA.branding.color).toBe("blue");
  expect(MARKETPLACE_BRANDING_COLORS).toContain(
    MARKETPLACE_METADATA.branding.color,
  );
  expect(MARKETPLACE_CATEGORIES.pickedAtPublishTime).toBe(true);
  expect(MARKETPLACE_CATEGORIES.primary).toBe("Continuous integration");
  expect(MARKETPLACE_CATEGORIES.secondary).toBe("Publishing");
  expect(MARKETPLACE_LISTING.status).toBe("live");
  expect(MARKETPLACE_LISTING.listedOn).toBe("2026-09-01");
  expect(MARKETPLACE_LISTING.listedFromRelease).toBe("v0.1.0");
  expect(MARKETPLACE_LISTING.liveUrl).toBe(
    "https://github.com/marketplace/actions/policysemver",
  );
  expect(MARKETPLACE_LISTING.nameWasUniqueAtListTime).toBe(true);
  expect(MARKETPLACE_LISTING.githubUserOrOrgDidNotExist).toBe(true);
  expect(MARKETPLACE_OPERATOR.twoFactorRequired).toBe(true);
  expect(MARKETPLACE_OPERATOR.developerAgreementRequired).toBe(true);
  expect(MARKETPLACE_OPERATOR.publishViaReleaseCheckbox).toBe(true);
  expect(MARKETPLACE_OPERATOR.doNotCreateTagOnlyToList).toBe(true);
  expect(MARKETPLACE_OPERATOR.consumersPinSha).toBe(true);
  expect(MARKETPLACE_DOCS.reVerified).toBe("2026-09-01");
});

it("root action.yml is Marketplace metadata; dogfood only changes main", () => {
  expect(existsSync(path.join(root, "action.yml"))).toBe(true);
  expect(existsSync(path.join(root, "action.yaml"))).toBe(false);
  const rootYml = read("action.yml");
  const dogfood = read("packages/action/action.yml");
  expect(field(rootYml, "name")).toBe(MARKETPLACE_METADATA.name);
  expect(field(rootYml, "description")).toBe(MARKETPLACE_METADATA.description);
  expect(field(rootYml, "author")).toBe(MARKETPLACE_METADATA.author);
  expect(indented(rootYml, "icon")).toBe(MARKETPLACE_METADATA.branding.icon);
  expect(indented(rootYml, "color")).toBe(MARKETPLACE_METADATA.branding.color);
  expect(indented(rootYml, "using")).toBe("node24");
  expect(indented(rootYml, "main")).toBe("dist/index.js");
  expect(field(dogfood, "name")).toBe(field(rootYml, "name"));
  expect(field(dogfood, "description")).toBe(field(rootYml, "description"));
  expect(indented(dogfood, "icon")).toBe(indented(rootYml, "icon"));
  expect(indented(dogfood, "color")).toBe(indented(rootYml, "color"));
  expect(indented(dogfood, "main")).toBe("../../dist/index.js");
  for (const key of ["config-path", "dry-run", "token"]) {
    expect(rootYml).toContain(`${key}:`);
    expect(dogfood).toContain(`${key}:`);
  }
});

it("root README documents live Marketplace and keeps SHA pins", () => {
  const readme = read("README.md");
  expect(readme).toMatch(/## GitHub Marketplace/);
  expect(readme).toMatch(
    /https:\/\/github\.com\/marketplace\/actions\/policysemver/,
  );
  expect(readme).not.toMatch(/Scheduled 2026-09-01/);
  expect(readme).toMatch(/Continuous integration/);
  expect(readme).toMatch(/Publishing/);
  expect(readme).toMatch(/uses: besarrahmat\/policy-semver@<full-commit-sha>/);
  expect(readme).not.toMatch(/IMPLEMENTATION-PLAN/);
  const examples = read("examples/README.md");
  expect(examples).toMatch(
    /https:\/\/github\.com\/marketplace\/actions\/policysemver/,
  );
  expect(examples).toMatch(
    /uses: besarrahmat\/policy-semver@<full-commit-sha>/,
  );
});
