import { describe, expect, it } from "vitest";

import {
  getAssistantBotDisplayName,
  getAssistantBotProfile,
  isAssistantBotId,
  normalizeAssistantBotId,
  resolveAssistantBotId
} from "@/lib/assistant-bots";

describe("assistant bot profiles", () => {
  it("resolves fallback bot id to Tyler.Durden", () => {
    expect(resolveAssistantBotId("invalid")).toBe("tyler_durden");
  });

  it("validates known bot ids", () => {
    expect(isAssistantBotId("hemingway_ernest")).toBe(true);
    expect(isAssistantBotId("michael_corleone")).toBe(true);
    expect(isAssistantBotId("alfred_sentry")).toBe(true);
    expect(isAssistantBotId("")).toBe(false);
  });

  it("uses Korean display for zhuge in ko locale", () => {
    expect(getAssistantBotDisplayName("zhuge_liang", "ko-KR")).toBe("제갈량");
  });

  it("falls back to Zhuge Liang for non-ko locale", () => {
    expect(getAssistantBotDisplayName("zhuge_liang", "en-US")).toBe("Zhuge Liang");
  });

  it("maps legacy alias to michael corleone", () => {
    expect(normalizeAssistantBotId("alfred_sentry")).toBe("michael_corleone");
    expect(getAssistantBotDisplayName("alfred_sentry")).toBe("Michael Corleone");
    expect(getAssistantBotProfile("alfred_sentry").roleLabel).toContain("SENTRY");
  });
});
