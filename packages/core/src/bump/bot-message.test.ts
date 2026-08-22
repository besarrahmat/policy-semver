import { describe, expect, it } from "vitest";
import { formatBotBumpCommitMessage } from "./bot-message.js";
import { BOT_SKIP_TRAILER } from "./locks.js";

describe("formatBotBumpCommitMessage", () => {
  it("message includes skip trailer", () => {
    expect(formatBotBumpCommitMessage("1.5.0")).toBe(
      `chore(release): v1.5.0 ${BOT_SKIP_TRAILER}`,
    );
  });
});
