import { ASSISTANT_BOT_IDS } from "@/lib/assistant-bots";
import type { AssistantBotId } from "@/lib/assistant-types";

const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
const DEFAULT_TIMEZONE = "Asia/Seoul";
const DEFAULT_RATE_LIMIT_PER_MINUTE = 20;
const DEFAULT_LOCAL_HEAVY_CHARS_THRESHOLD = 520;
const DEFAULT_DAILY_COST_CAP_USD = 15;
const DEFAULT_DAILY_TOKEN_CAP = 250_000;

interface AssistantBotRuntimeConfig {
  token: string;
  webhookSecret: string;
  username: string;
}

export interface AssistantConfig {
  telegramBots: Record<AssistantBotId, AssistantBotRuntimeConfig>;
  telegramAllowedUserIds: Set<number>;
  telegramAllowedChatIds: Set<number>;
  telegramMayhemChatId?: number;
  openAiApiKey: string;
  openAiModel: string;
  anthropicApiKey: string;
  anthropicModel: string;
  assistantTimezone: string;
  rateLimitPerMinute: number;
  localWorkerSecret: string;
  localHeavyCharsThreshold: number;
  dailyCostCapUsd: number;
  dailyTokenCap: number;
}

const BOT_ENV_KEYS: Record<
  AssistantBotId,
  {
    tokenKey: string;
    secretKey: string;
    usernameKey: string;
    legacyTokenKey?: string;
    legacySecretKey?: string;
    legacyUsernameKey?: string;
  }
> = {
  tyler_durden: {
    tokenKey: "TELEGRAM_BOT_COS_TOKEN",
    secretKey: "TELEGRAM_BOT_COS_SECRET",
    usernameKey: "TELEGRAM_BOT_COS_USERNAME",
    legacyTokenKey: "TELEGRAM_BOT_TOKEN",
    legacySecretKey: "TELEGRAM_WEBHOOK_SECRET",
    legacyUsernameKey: "TELEGRAM_BOT_USERNAME"
  },
  zhuge_liang: {
    tokenKey: "TELEGRAM_BOT_LENS_TOKEN",
    secretKey: "TELEGRAM_BOT_LENS_SECRET",
    usernameKey: "TELEGRAM_BOT_LENS_USERNAME"
  },
  jensen_huang: {
    tokenKey: "TELEGRAM_BOT_BOLT_TOKEN",
    secretKey: "TELEGRAM_BOT_BOLT_SECRET",
    usernameKey: "TELEGRAM_BOT_BOLT_USERNAME"
  },
  hemingway_ernest: {
    tokenKey: "TELEGRAM_BOT_INK_TOKEN",
    secretKey: "TELEGRAM_BOT_INK_SECRET",
    usernameKey: "TELEGRAM_BOT_INK_USERNAME"
  },
  alfred_sentry: {
    tokenKey: "TELEGRAM_BOT_SENTRY_TOKEN",
    secretKey: "TELEGRAM_BOT_SENTRY_SECRET",
    usernameKey: "TELEGRAM_BOT_SENTRY_USERNAME"
  }
};

function parseIdSet(
  rawValue: string | undefined,
  options?: {
    allowNegative?: boolean;
  }
): Set<number> {
  if (!rawValue) {
    return new Set();
  }

  const allowNegative = options?.allowNegative ?? false;
  const parsed = rawValue
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => Number(token))
    .filter((value) => Number.isInteger(value))
    .filter((value) => (allowNegative ? value !== 0 : value > 0));

  return new Set(parsed);
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseChatId(rawValue: string | undefined): number | undefined {
  if (!rawValue) {
    return undefined;
  }
  const parsed = Number(rawValue.trim());
  if (!Number.isInteger(parsed) || parsed === 0) {
    return undefined;
  }
  return parsed;
}

function readAssistantBotRuntimeConfig(botId: AssistantBotId): AssistantBotRuntimeConfig {
  const keys = BOT_ENV_KEYS[botId];
  const token =
    process.env[keys.tokenKey] ??
    (keys.legacyTokenKey ? process.env[keys.legacyTokenKey] : "") ??
    "";
  const webhookSecret =
    process.env[keys.secretKey] ??
    (keys.legacySecretKey ? process.env[keys.legacySecretKey] : "") ??
    "";
  const username =
    process.env[keys.usernameKey] ??
    (keys.legacyUsernameKey ? process.env[keys.legacyUsernameKey] : "") ??
    "";

  return {
    token,
    webhookSecret,
    username
  };
}

export function getAssistantConfig(): AssistantConfig {
  return {
    telegramBots: {
      tyler_durden: readAssistantBotRuntimeConfig("tyler_durden"),
      zhuge_liang: readAssistantBotRuntimeConfig("zhuge_liang"),
      jensen_huang: readAssistantBotRuntimeConfig("jensen_huang"),
      hemingway_ernest: readAssistantBotRuntimeConfig("hemingway_ernest"),
      alfred_sentry: readAssistantBotRuntimeConfig("alfred_sentry")
    },
    telegramAllowedUserIds: parseIdSet(process.env.TELEGRAM_ALLOWED_USER_IDS),
    telegramAllowedChatIds: parseIdSet(process.env.TELEGRAM_ALLOWED_CHAT_IDS, {
      allowNegative: true
    }),
    telegramMayhemChatId: parseChatId(process.env.TELEGRAM_MAYHEM_CHAT_ID),
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    openAiModel: process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
    anthropicModel: process.env.ANTHROPIC_MODEL ?? DEFAULT_ANTHROPIC_MODEL,
    assistantTimezone: process.env.ASSISTANT_TIMEZONE ?? DEFAULT_TIMEZONE,
    rateLimitPerMinute: parsePositiveInt(
      process.env.ASSISTANT_RATE_LIMIT_PER_MIN,
      DEFAULT_RATE_LIMIT_PER_MINUTE
    ),
    localWorkerSecret: process.env.LOCAL_WORKER_SECRET ?? process.env.CRON_SECRET ?? "",
    localHeavyCharsThreshold: parsePositiveInt(
      process.env.ASSISTANT_LOCAL_HEAVY_CHARS_THRESHOLD,
      DEFAULT_LOCAL_HEAVY_CHARS_THRESHOLD
    ),
    dailyCostCapUsd: parsePositiveNumber(
      process.env.ASSISTANT_DAILY_COST_CAP_USD,
      DEFAULT_DAILY_COST_CAP_USD
    ),
    dailyTokenCap: parsePositiveInt(process.env.ASSISTANT_DAILY_TOKEN_CAP, DEFAULT_DAILY_TOKEN_CAP)
  };
}

function appendMissingBotKeys(missing: string[], config: AssistantConfig, botId: AssistantBotId) {
  const bot = config.telegramBots[botId];
  const envKeys = BOT_ENV_KEYS[botId];

  if (!bot.token) {
    missing.push(envKeys.tokenKey);
  }
  if (!bot.webhookSecret) {
    missing.push(envKeys.secretKey);
  }
}

export function getAssistantMissingConfigKeys(
  config = getAssistantConfig(),
  options?: {
    botId?: AssistantBotId;
    requireAllBots?: boolean;
  }
): string[] {
  const missing: string[] = [];
  const targetBotIds = options?.requireAllBots
    ? ASSISTANT_BOT_IDS
    : [options?.botId ?? "tyler_durden"];

  for (const botId of targetBotIds) {
    appendMissingBotKeys(missing, config, botId);
  }
  if (!config.openAiApiKey) {
    missing.push("OPENAI_API_KEY");
  }
  if (!config.anthropicApiKey) {
    missing.push("ANTHROPIC_API_KEY");
  }
  if (config.telegramAllowedUserIds.size === 0 && config.telegramAllowedChatIds.size === 0) {
    missing.push("TELEGRAM_ALLOWED_USER_IDS or TELEGRAM_ALLOWED_CHAT_IDS");
  }

  return missing;
}

export function isAssistantConfigured(
  config = getAssistantConfig(),
  options?: {
    botId?: AssistantBotId;
    requireAllBots?: boolean;
  }
): boolean {
  return getAssistantMissingConfigKeys(config, options).length === 0;
}

export function isAllowlisted(
  userId: number | undefined,
  chatId: number | undefined,
  config = getAssistantConfig()
): boolean {
  if (!userId || !chatId) {
    return false;
  }

  const hasAllowlist = config.telegramAllowedUserIds.size > 0 || config.telegramAllowedChatIds.size > 0;
  if (!hasAllowlist) {
    return false;
  }

  const userAllowed =
    config.telegramAllowedUserIds.size === 0 || config.telegramAllowedUserIds.has(userId);
  const chatAllowed =
    config.telegramAllowedChatIds.size === 0 || config.telegramAllowedChatIds.has(chatId);

  return userAllowed && chatAllowed;
}

export function isWebhookSecretValid(
  receivedSecret: string | null,
  botId: AssistantBotId = "tyler_durden",
  config = getAssistantConfig()
): boolean {
  const targetBot = config.telegramBots[botId];
  if (!targetBot?.webhookSecret) {
    return false;
  }
  return receivedSecret === targetBot.webhookSecret;
}

export function getAssistantBotRuntimeConfig(
  botId: AssistantBotId,
  config = getAssistantConfig()
): AssistantBotRuntimeConfig {
  return config.telegramBots[botId];
}

export function maskConfigValue(value: string): string {
  if (!value) {
    return "";
  }
  if (value.length <= 8) {
    return "***";
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

export function getAssistantConfigSummary(config = getAssistantConfig()) {
  return {
    telegramBots: ASSISTANT_BOT_IDS.reduce<Record<string, Record<string, string>>>((acc, botId) => {
      const runtime = config.telegramBots[botId];
      acc[botId] = {
        token: maskConfigValue(runtime.token),
        webhookSecret: maskConfigValue(runtime.webhookSecret),
        username: runtime.username
      };
      return acc;
    }, {}),
    openAiModel: config.openAiModel,
    anthropicModel: config.anthropicModel,
    assistantTimezone: config.assistantTimezone,
    rateLimitPerMinute: config.rateLimitPerMinute,
    localHeavyCharsThreshold: config.localHeavyCharsThreshold,
    dailyCostCapUsd: config.dailyCostCapUsd,
    dailyTokenCap: config.dailyTokenCap,
    allowlist: {
      users: config.telegramAllowedUserIds.size,
      chats: config.telegramAllowedChatIds.size
    },
    mayhemChatId: config.telegramMayhemChatId ?? null,
    localWorkerSecret: maskConfigValue(config.localWorkerSecret),
    workerAuthConfigured: Boolean(config.localWorkerSecret)
  };
}

export function __private_parseIdSet(
  rawValue: string | undefined,
  options?: {
    allowNegative?: boolean;
  }
) {
  return parseIdSet(rawValue, options);
}
