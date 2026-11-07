import { expect, it, vi } from "vitest";

const setFailed = vi.fn();
vi.mock("@actions/core", () => ({ setFailed }));
vi.mock("./run-action.js", () => ({
  runAction: async () => {
    throw new Error("boom ghp_abcdefghijklmnopqrstuvwxyz012345");
  },
}));

it("redacts an uncaught failure before reporting it (I6)", async () => {
  vi.stubEnv("GITHUB_ACTIONS", "true");
  await import("./index.js");
  await vi.waitFor(() => expect(setFailed).toHaveBeenCalled());
  expect(setFailed).toHaveBeenCalledWith("boom [REDACTED]");
  vi.unstubAllEnvs();
});
