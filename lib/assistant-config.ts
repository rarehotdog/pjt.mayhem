import {
  ASSISTANT_BOT_IDS,
  isAssistantBotId,
  normalizeAssistantBotId
} from "@/lib/assistant-bots";
import type { AssistantBotId, AssistantCanonicalBotId } from "@/lib/assistant-types";

const DEFAULT_OPENAI_MODEL = "gpt-5.2";
const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-5";
const DEFAULT_TIMEZONE = "Asia/Seoul";
const DEFAULT_RATE_LIMIT_PER_MINUTE = 20;
const DEFAULT_LOCAL_HEAVY_CHARS_THRESHOLD = 520;
const DEFAULT_LOCAL_HEAVY_TOKEN_THRESHOLD = 2200;
const DEFAULT_HISTORY_WINDOW_CLOUD = 8;
const DEFAULT_HISTORY_WINDOW_LOCAL = 20;
const DEFAULT_LOCAL_HEAVY_ENABLE_BOTS: AssistantCanonicalBotId[] = [
  "tyler_durden",
  "zhuge_liang",
  "jensen_huang",
  "hemingway_ernest"
];
const DEFAULT_NEWS_DEFAULT_COUNT = 5;
const DEFAULT_DAILY_COST_CAP_USD = 15;
const DEFAULT_DAILY_TOKEN_CAP = 250_000;

interface AssistantBotRuntimeConfig {
  token: string;
  webhookSecret: string;
  username: string;
}

export interface AssistantConfig {
  telegramBots: Record<AssistantCanonicalBotId, AssistantBotRuntimeConfig>;
  telegramAllowedUserIds: Set<number>;
  telegramAllowedChatIds: Set<number>;
  telegramMayhemChatId?: number;
  telegramTylerDmChatId?: number;
  openAiApiKey: string;
  openAiModel: string;
  openAiModelCandidates: string[];
  anthropicApiKey: string;
  anthropicModel: string;
  assistantTimezone: string;
  rateLimitPerMinute: number;
  localWorkerSecret: string;
  localHeavyCharsThreshold: number;
  localHeavyTokenThreshold: number;
  localHeavyEnableBots: Set<AssistantCanonicalBotId>;
  historyWindowCloud: number;
  historyWindowLocal: number;
  newsDefaultCount: number;
  dailyCostCapUsd: number;
  dailyTokenCap: number;
}

const BOT_ENV_KEYS: Record<
  AssistantCanonicalBotId,
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
  michael_corleone: {
    tokenKey: "TELEGRAM_BOT_CORLEONE_TOKEN",
    secretKey: "TELEGRAM_BOT_CORLEONE_SECRET",
    usernameKey: "TELEGRAM_BOT_CORLEONE_USERNAME",
    legacyTokenKey: "TELEGRAM_BOT_SENTRY_TOKEN",
    legacySecretKey: "TELEGRAM_BOT_SENTRY_SECRET",
    legacyUsernameKey: "TELEGRAM_BOT_SENTRY_USERNAME"
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

  const result = new Set(parsed);
  if (allowNegative) {
    for (const value of parsed) {
      const raw = String(value);
      if (!raw.startsWith("-") || raw.startsWith("-100")) {
        continue;
      }
      const migrated = Number(`-100${raw.slice(1)}`);
      if (Number.isSafeInteger(migrated)) {
        result.add(migrated);
      }
    }
  }

  return result;
}

function parsePositiveInt(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveNumber(rawValue: string | undefined, fallback: number): number {
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseStringList(rawValue: string | undefined): string[] {
  if (!rawValue) {
    return [];
  }

  const unique = new Set<string>();
  const values: string[] = [];
  for (const token of rawValue.split(",")) {
    const trimmed = token.trim();
    if (!trimmed || unique.has(trimmed)) {
      continue;
    }
    unique.add(trimmed);
    values.push(trimmed);
  }
  return values;
}

function parseBotIdSet(
  rawValue: string | undefined,
  fallback: AssistantCanonicalBotId[]
): Set<AssistantCanonicalBotId> {
  const list = parseStringList(rawValue);
  if (list.length === 0) {
    return new Set(fallback);
  }

  const valid = new Set<AssistantCanonicalBotId>();
  for (const candidate of list) {
    if (isAssistantBotId(candidate)) {
      valid.add(normalizeAssistantBotId(candidate));
    }
  }
  return valid.size > 0 ? valid : new Set(fallback);
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

function readEnvFirstNonEmpty(keys: Array<string | undefined>) {
  for (const key of keys) {
    if (!key) {
      continue;
    }
    const value = process.env[key]?.trim();
    if (value) {
      return value;
    }
  }
  return "";
}

function readAssistantBotRuntimeConfig(botId: AssistantBotId): AssistantBotRuntimeConfig {
  const canonicalBotId = normalizeAssistantBotId(botId);
  const keys = BOT_ENV_KEYS[canonicalBotId];
  const token = readEnvFirstNonEmpty([keys.tokenKey, keys.legacyTokenKey]);
  const webhookSecret = readEnvFirstNonEmpty([keys.secretKey, keys.legacySecretKey]);
  const username = readEnvFirstNonEmpty([keys.usernameKey, keys.legacyUsernameKey]);

  return {
    token,
    webhookSecret,
    username
  };
}

export function getAssistantConfig(): AssistantConfig {
  const openAiModel = process.env.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL;
  const openAiModelCandidates = parseStringList(process.env.OPENAI_MODEL_CANDIDATES);
  if (!openAiModelCandidates.includes(openAiModel)) {
    openAiModelCandidates.unshift(openAiModel);
  }

  return {
    telegramBots: {
      tyler_durden: readAssistantBotRuntimeConfig("tyler_durden"),
      zhuge_liang: readAssistantBotRuntimeConfig("zhuge_liang"),
      jensen_huang: readAssistantBotRuntimeConfig("jensen_huang"),
      hemingway_ernest: readAssistantBotRuntimeConfig("hemingway_ernest"),
      michael_corleone: readAssistantBotRuntimeConfig("michael_corleone")
    },
    telegramAllowedUserIds: parseIdSet(process.env.TELEGRAM_ALLOWED_USER_IDS),
    telegramAllowedChatIds: parseIdSet(process.env.TELEGRAM_ALLOWED_CHAT_IDS, {
      allowNegative: true
    }),
    telegramMayhemChatId: parseChatId(process.env.TELEGRAM_MAYHEM_CHAT_ID),
    telegramTylerDmChatId: parseChatId(process.env.TELEGRAM_TYLER_DM_CHAT_ID),
    openAiApiKey: process.env.OPENAI_API_KEY ?? "",
    openAiModel,
    openAiModelCandidates,
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
    localHeavyTokenThreshold: parsePositiveInt(
      process.env.ASSISTANT_LOCAL_HEAVY_TOKEN_THRESHOLD,
      DEFAULT_LOCAL_HEAVY_TOKEN_THRESHOLD
    ),
    localHeavyEnableBots: parseBotIdSet(
      process.env.ASSISTANT_LOCAL_HEAVY_ENABLE_BOTS,
      DEFAULT_LOCAL_HEAVY_ENABLE_BOTS
    ),
    historyWindowCloud: parsePositiveInt(
      process.env.ASSISTANT_HISTORY_WINDOW_CLOUD,
      DEFAULT_HISTORY_WINDOW_CLOUD
    ),
    historyWindowLocal: parsePositiveInt(
      process.env.ASSISTANT_HISTORY_WINDOW_LOCAL,
      DEFAULT_HISTORY_WINDOW_LOCAL
    ),
    newsDefaultCount: parsePositiveInt(
      process.env.ASSISTANT_NEWS_DEFAULT_COUNT,
      DEFAULT_NEWS_DEFAULT_COUNT
    ),
    dailyCostCapUsd: parsePositiveNumber(
      process.env.ASSISTANT_DAILY_COST_CAP_USD,
      DEFAULT_DAILY_COST_CAP_USD
    ),
    dailyTokenCap: parsePositiveInt(process.env.ASSISTANT_DAILY_TOKEN_CAP, DEFAULT_DAILY_TOKEN_CAP)
  };
}

function appendMissingBotKeys(missing: string[], config: AssistantConfig, botId: AssistantBotId) {
  const canonicalBotId = normalizeAssistantBotId(botId);
  const bot = config.telegramBots[canonicalBotId];
  const envKeys = BOT_ENV_KEYS[canonicalBotId];

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
    : [normalizeAssistantBotId(options?.botId)];

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
  const targetBot = config.telegramBots[normalizeAssistantBotId(botId)];
  if (!targetBot?.webhookSecret) {
    return false;
  }
  return receivedSecret === targetBot.webhookSecret;
}

export function getAssistantBotRuntimeConfig(
  botId: AssistantBotId,
  config = getAssistantConfig()
): AssistantBotRuntimeConfig {
  return config.telegramBots[normalizeAssistantBotId(botId)];
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
    openAiModelCandidates: config.openAiModelCandidates,
    anthropicModel: config.anthropicModel,
    assistantTimezone: config.assistantTimezone,
    rateLimitPerMinute: config.rateLimitPerMinute,
    localHeavyCharsThreshold: config.localHeavyCharsThreshold,
    localHeavyTokenThreshold: config.localHeavyTokenThreshold,
    localHeavyEnableBots: Array.from(config.localHeavyEnableBots),
    historyWindowCloud: config.historyWindowCloud,
    historyWindowLocal: config.historyWindowLocal,
    newsDefaultCount: config.newsDefaultCount,
    dailyCostCapUsd: config.dailyCostCapUsd,
    dailyTokenCap: config.dailyTokenCap,
    allowlist: {
      users: config.telegramAllowedUserIds.size,
      chats: config.telegramAllowedChatIds.size
    },
    mayhemChatId: config.telegramMayhemChatId ?? null,
    tylerDmChatId: config.telegramTylerDmChatId ?? null,
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

export function __private_parseStringList(rawValue: string | undefined) {
  return parseStringList(rawValue);
}

export function __private_parseBotIdSet(
  rawValue: string | undefined,
  fallback: AssistantCanonicalBotId[] = DEFAULT_LOCAL_HEAVY_ENABLE_BOTS
) {
  return parseBotIdSet(rawValue, fallback);
}
