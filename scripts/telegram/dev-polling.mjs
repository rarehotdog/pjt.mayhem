#!/usr/bin/env node

const REQUESTED_BOT_ID = process.argv[2] ?? process.env.TELEGRAM_SCRIPT_BOT_ID ?? "tyler_durden";
const BOT_ID = normalizeBotId(REQUESTED_BOT_ID);
const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const TIMEOUT_SECONDS = Number(process.env.TELEGRAM_POLL_TIMEOUT_SECONDS ?? "25");

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
if (!bot.secret) {
  console.error(`[ERROR] webhook secret is required for ${BOT_ID}`);
  process.exit(1);
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${bot.token}`;
let offset = Number(process.env.TELEGRAM_POLL_OFFSET ?? "0");
let running = true;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callTelegram(method, payload) {
  const response = await fetch(`${TELEGRAM_API_BASE}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const parsed = await response.json().catch(() => null);
  if (!response.ok || !parsed?.ok) {
    throw new Error(
      `Telegram ${method} failed (${response.status}): ${parsed?.description ?? "unknown error"}`
    );
  }
  return parsed.result;
}

async function forwardUpdate(update) {
  const response = await fetch(`${APP_BASE_URL}/api/telegram/webhook/${BOT_ID}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Telegram-Bot-Api-Secret-Token": bot.secret
    },
    body: JSON.stringify(update)
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Webhook forward failed (${response.status}): ${body.slice(0, 200)}`);
  }
}

async function loop() {
  console.log(
    `[INFO] starting telegram polling for ${BOT_ID} -> ${APP_BASE_URL}/api/telegram/webhook/${BOT_ID} (offset=${offset})`
  );

  while (running) {
    try {
      const updates = await callTelegram("getUpdates", {
        offset,
        timeout: TIMEOUT_SECONDS,
        allowed_updates: ["message", "edited_message"]
      });

      for (const update of updates) {
        await forwardUpdate(update);
        offset = update.update_id + 1;
        console.log(`[PASS] ${BOT_ID} update ${update.update_id} forwarded`);
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      console.error(`[ERROR] ${message}`);
      await sleep(1500);
    }
  }
}

process.on("SIGINT", () => {
  running = false;
  console.log("\n[INFO] stopping polling...");
});

process.on("SIGTERM", () => {
  running = false;
});

loop().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[FATAL] ${message}`);
  process.exit(1);
});
