import { describe, expect, it } from "vitest";

import {
  getAssistantBotDisplayName,
  getAssistantBotProfile,
  isAssistantBotId,
  resolveAssistantBotId
} from "@/lib/assistant-bots";

describe("assistant bot profiles", () => {
  it("resolves fallback bot id to Tyler.Durden", () => {
    expect(resolveAssistantBotId("invalid")).toBe("tyler_durden");
  });

  it("validates known bot ids", () => {
    expect(isAssistantBotId("hemingway_ernest")).toBe(true);
    expect(isAssistantBotId("")).toBe(false);
  });

  it("uses Korean display for zhuge in ko locale", () => {
    expect(getAssistantBotDisplayName("zhuge_liang", "ko-KR")).toBe("제갈량");
  });

  it("falls back to Zhuge Liang for non-ko locale", () => {
    expect(getAssistantBotDisplayName("zhuge_liang", "en-US")).toBe("Zhuge Liang");
  });

  it("keeps SENTRY naming", () => {
    expect(getAssistantBotProfile("alfred_sentry").roleLabel).toContain("SENTRY");
  });
});
