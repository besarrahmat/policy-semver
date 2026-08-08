import { describe, expect, it } from "vitest";
import { ping } from "./index.js";

describe("core stub", () => {
  it("pings", () => {
    expect(ping()).toBe("ok");
  });
});
