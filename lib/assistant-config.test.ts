import { describe, expect, it } from "vitest";

import {
  __private_parseBotIdSet,
  __private_parseIdSet,
  __private_parseStringList,
  getAssistantBotRuntimeConfig,
  getAssistantConfig,
  isAllowlisted,
  isWebhookSecretValid,
  type AssistantConfig
} from "@/lib/assistant-config";
import type { AssistantCanonicalBotId } from "@/lib/assistant-types";

function baseConfig(overrides: Partial<AssistantConfig> = {}): AssistantConfig {
  return {
    telegramBots: {
      tyler_durden: {
        token: "token-cos",
        webhookSecret: "secret-cos",
        username: "tyler"
      },
      zhuge_liang: {
        token: "token-lens",
        webhookSecret: "secret-lens",
        username: "lens"
      },
      jensen_huang: {
        token: "token-bolt",
        webhookSecret: "secret-bolt",
        username: "bolt"
      },
      hemingway_ernest: {
        token: "token-ink",
        webhookSecret: "secret-ink",
        username: "ink"
      },
      michael_corleone: {
        token: "token-sentry",
        webhookSecret: "secret-sentry",
        username: "sentry"
      }
    },
    telegramAllowedUserIds: new Set<number>([111]),
    telegramAllowedChatIds: new Set<number>([222]),
    openAiApiKey: "openai",
    openAiModel: "gpt-5.2",
    openAiModelCandidates: ["gpt-5.2", "gpt-5.1", "gpt-5"],
    anthropicApiKey: "anthropic",
    anthropicModel: "claude-sonnet-4-5",
    assistantTimezone: "Asia/Seoul",
    rateLimitPerMinute: 20,
    localWorkerSecret: "worker-secret",
    localHeavyCharsThreshold: 520,
    localHeavyTokenThreshold: 2200,
    localHeavyEnableBots: new Set<AssistantCanonicalBotId>([
      "tyler_durden",
      "zhuge_liang",
      "jensen_huang",
      "hemingway_ernest"
    ]),
    historyWindowCloud: 8,
    historyWindowLocal: 20,
    newsDefaultCount: 5,
    dailyCostCapUsd: 15,
    dailyTokenCap: 250000,
    ...overrides
  };
}

describe("assistant-config", () => {
  it("parses comma-separated allowlist ids", () => {
    const parsed = __private_parseIdSet("10, 11, invalid, -2, 11");
    expect(Array.from(parsed)).toEqual([10, 11]);
  });

  it("parses negative chat ids for group allowlist", () => {
    const parsed = __private_parseIdSet("10, -100123, 0, invalid", {
      allowNegative: true
    });
    expect(Array.from(parsed)).toEqual([10, -100123]);
  });

  it("parses and deduplicates string lists", () => {
    const parsed = __private_parseStringList("gpt-5.2, gpt-5.1, gpt-5.2, gpt-5");
    expect(parsed).toEqual(["gpt-5.2", "gpt-5.1", "gpt-5"]);
  });

  it("parses local heavy bot allowlist with fallback", () => {
    const parsed = __private_parseBotIdSet("zhuge_liang,invalid,jensen_huang");
    expect(Array.from(parsed)).toEqual(["zhuge_liang", "jensen_huang"]);
  });

  it("normalizes legacy bot alias in local heavy allowlist", () => {
    const parsed = __private_parseBotIdSet("alfred_sentry");
    expect(Array.from(parsed)).toEqual(["michael_corleone"]);
  });

  it("blocks requests that are not in allowlist", () => {
    expect(isAllowlisted(999, 222, baseConfig())).toBe(false);
    expect(isAllowlisted(111, 999, baseConfig())).toBe(false);
  });

  it("allows requests in allowlist", () => {
    expect(isAllowlisted(111, 222, baseConfig())).toBe(true);
  });

  it("allows negative group chat ids in allowlist", () => {
    const config = baseConfig({
      telegramAllowedChatIds: new Set<number>([-5068790852])
    });
    expect(isAllowlisted(111, -5068790852, config)).toBe(true);
  });

  it("validates webhook secret", () => {
    expect(isWebhookSecretValid("secret-cos", "tyler_durden", baseConfig())).toBe(true);
    expect(isWebhookSecretValid("secret-lens", "zhuge_liang", baseConfig())).toBe(true);
    expect(isWebhookSecretValid("wrong", "tyler_durden", baseConfig())).toBe(false);
  });

  it("prefers CORLEONE env keys and falls back to SENTRY keys", () => {
    const backup = {
      TELEGRAM_BOT_CORLEONE_TOKEN: process.env.TELEGRAM_BOT_CORLEONE_TOKEN,
      TELEGRAM_BOT_CORLEONE_SECRET: process.env.TELEGRAM_BOT_CORLEONE_SECRET,
      TELEGRAM_BOT_CORLEONE_USERNAME: process.env.TELEGRAM_BOT_CORLEONE_USERNAME,
      TELEGRAM_BOT_SENTRY_TOKEN: process.env.TELEGRAM_BOT_SENTRY_TOKEN,
      TELEGRAM_BOT_SENTRY_SECRET: process.env.TELEGRAM_BOT_SENTRY_SECRET,
      TELEGRAM_BOT_SENTRY_USERNAME: process.env.TELEGRAM_BOT_SENTRY_USERNAME
    };

    try {
      process.env.TELEGRAM_BOT_CORLEONE_TOKEN = "";
      process.env.TELEGRAM_BOT_CORLEONE_SECRET = "";
      process.env.TELEGRAM_BOT_CORLEONE_USERNAME = "";
      process.env.TELEGRAM_BOT_SENTRY_TOKEN = "legacy-token";
      process.env.TELEGRAM_BOT_SENTRY_SECRET = "legacy-secret";
      process.env.TELEGRAM_BOT_SENTRY_USERNAME = "legacy-username";

      const configFromLegacy = getAssistantConfig();
      const fromLegacy = getAssistantBotRuntimeConfig("michael_corleone", configFromLegacy);
      expect(fromLegacy.token).toBe("legacy-token");
      expect(fromLegacy.webhookSecret).toBe("legacy-secret");
      expect(fromLegacy.username).toBe("legacy-username");

      process.env.TELEGRAM_BOT_CORLEONE_TOKEN = "new-token";
      process.env.TELEGRAM_BOT_CORLEONE_SECRET = "new-secret";
      process.env.TELEGRAM_BOT_CORLEONE_USERNAME = "new-username";

      const configFromPrimary = getAssistantConfig();
      const fromPrimary = getAssistantBotRuntimeConfig("michael_corleone", configFromPrimary);
      expect(fromPrimary.token).toBe("new-token");
      expect(fromPrimary.webhookSecret).toBe("new-secret");
      expect(fromPrimary.username).toBe("new-username");
    } finally {
      process.env.TELEGRAM_BOT_CORLEONE_TOKEN = backup.TELEGRAM_BOT_CORLEONE_TOKEN;
      process.env.TELEGRAM_BOT_CORLEONE_SECRET = backup.TELEGRAM_BOT_CORLEONE_SECRET;
      process.env.TELEGRAM_BOT_CORLEONE_USERNAME = backup.TELEGRAM_BOT_CORLEONE_USERNAME;
      process.env.TELEGRAM_BOT_SENTRY_TOKEN = backup.TELEGRAM_BOT_SENTRY_TOKEN;
      process.env.TELEGRAM_BOT_SENTRY_SECRET = backup.TELEGRAM_BOT_SENTRY_SECRET;
      process.env.TELEGRAM_BOT_SENTRY_USERNAME = backup.TELEGRAM_BOT_SENTRY_USERNAME;
    }
  });
});
