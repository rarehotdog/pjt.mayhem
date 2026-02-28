#!/usr/bin/env node

const MODE = process.argv[2] ?? "info";
const REQUESTED_BOT_ID = process.argv[3] ?? process.env.TELEGRAM_SCRIPT_BOT_ID ?? "tyler_durden";
const BOT_ID = normalizeBotId(REQUESTED_BOT_ID);

function readEnv(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function normalizeBotId(botId) {
  return botId === "alfred_sentry" ? "michael_corleone" : botId;
}

const BOT_RUNTIME = {
  tyler_durden: {
    token: readEnv("TELEGRAM_BOT_COS_TOKEN", "TELEGRAM_BOT_TOKEN"),
    secret: readEnv("TELEGRAM_BOT_COS_SECRET", "TELEGRAM_WEBHOOK_SECRET")
  },
  zhuge_liang: {
    token: readEnv("TELEGRAM_BOT_LENS_TOKEN"),
    secret: readEnv("TELEGRAM_BOT_LENS_SECRET")
  },
  jensen_huang: {
    token: readEnv("TELEGRAM_BOT_BOLT_TOKEN"),
    secret: readEnv("TELEGRAM_BOT_BOLT_SECRET")
  },
  hemingway_ernest: {
    token: readEnv("TELEGRAM_BOT_INK_TOKEN"),
    secret: readEnv("TELEGRAM_BOT_INK_SECRET")
  },
  michael_corleone: {
    token: readEnv("TELEGRAM_BOT_CORLEONE_TOKEN", "TELEGRAM_BOT_SENTRY_TOKEN"),
    secret: readEnv("TELEGRAM_BOT_CORLEONE_SECRET", "TELEGRAM_BOT_SENTRY_SECRET")
  }
};

const bot = BOT_RUNTIME[BOT_ID];
if (!bot) {
  console.error(`[ERROR] unknown bot id: ${REQUESTED_BOT_ID}`);
  process.exit(1);
}
if (BOT_ID !== REQUESTED_BOT_ID) {
  console.log(`[INFO] bot alias mapped: ${REQUESTED_BOT_ID} -> ${BOT_ID}`);
}

if (!bot.token) {
  console.error(`[ERROR] bot token is required for ${BOT_ID}`);
  process.exit(1);
}

const WEBHOOK_URL = process.env.TELEGRAM_WEBHOOK_URL;
const TELEGRAM_API_BASE = `https://api.telegram.org/bot${bot.token}`;

async function callTelegram(method, payload = {}) {
  const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) {
    throw new Error(
      `Telegram ${method} failed (${response.status}): ${json?.description ?? "unknown error"}`
    );
  }
  return json.result;
}

async function printWebhookInfo() {
  const info = await callTelegram("getWebhookInfo");
  console.log(`[INFO] webhook info (${BOT_ID})`);
  console.log(JSON.stringify(info, null, 2));
}

async function setWebhook() {
  if (!WEBHOOK_URL) {
    throw new Error("TELEGRAM_WEBHOOK_URL is required for set/smoke mode.");
  }
  if (!bot.secret) {
    throw new Error(`Webhook secret is required for ${BOT_ID}.`);
  }
  await callTelegram("setWebhook", {
    url: WEBHOOK_URL,
    secret_token: bot.secret,
    allowed_updates: ["message", "edited_message"],
    drop_pending_updates: false
  });
  console.log(`[PASS] webhook set (${BOT_ID}) -> ${WEBHOOK_URL}`);
}

async function deleteWebhook() {
  await callTelegram("deleteWebhook", {
    drop_pending_updates: false
  });
  console.log(`[PASS] webhook deleted (${BOT_ID})`);
}

async function run() {
  if (MODE === "set") {
    await setWebhook();
    await printWebhookInfo();
    return;
  }

  if (MODE === "delete") {
    await deleteWebhook();
    await printWebhookInfo();
    return;
  }

  if (MODE === "smoke") {
    await setWebhook();
    await printWebhookInfo();
    await deleteWebhook();
    await printWebhookInfo();
    return;
  }

  await printWebhookInfo();
}

run().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
