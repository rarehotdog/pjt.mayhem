#!/usr/bin/env node

const REQUESTED_BOT_ID = process.argv[2] ?? process.env.TELEGRAM_SCRIPT_BOT_ID ?? "tyler_durden";
const BOT_ID = normalizeBotId(REQUESTED_BOT_ID);
const OFFSET = Number(process.env.TELEGRAM_WHOAMI_OFFSET ?? "0");

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
  tyler_durden: readEnv("TELEGRAM_BOT_COS_TOKEN", "TELEGRAM_BOT_TOKEN"),
  zhuge_liang: readEnv("TELEGRAM_BOT_LENS_TOKEN"),
  jensen_huang: readEnv("TELEGRAM_BOT_BOLT_TOKEN"),
  hemingway_ernest: readEnv("TELEGRAM_BOT_INK_TOKEN"),
  michael_corleone: readEnv("TELEGRAM_BOT_CORLEONE_TOKEN", "TELEGRAM_BOT_SENTRY_TOKEN")
};

const BOT_TOKEN = BOT_RUNTIME[BOT_ID];
if (!BOT_TOKEN) {
  console.error(`[ERROR] bot token is missing for ${REQUESTED_BOT_ID}`);
  process.exit(1);
}
if (BOT_ID !== REQUESTED_BOT_ID) {
  console.log(`[INFO] bot alias mapped: ${REQUESTED_BOT_ID} -> ${BOT_ID}`);
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

async function run() {
  const response = await fetch(`${TELEGRAM_API_BASE}/getUpdates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      offset: OFFSET,
      timeout: 5,
      allowed_updates: ["message"]
    })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) {
    throw new Error(
      `getUpdates failed (${response.status}): ${json?.description ?? "unknown error"}`
    );
  }

  const updates = Array.isArray(json.result) ? json.result : [];
  if (updates.length === 0) {
    console.log(`[INFO] no updates found for ${BOT_ID}. Send any message first, then rerun.`);
    return;
  }

  const latest = updates[updates.length - 1];
  const message = latest.message ?? latest.edited_message;
  const user = message?.from;
  const chat = message?.chat;

  console.log("[INFO] latest update IDs");
  console.log(
    JSON.stringify(
      {
        bot_id: BOT_ID,
        update_id: latest.update_id,
        user_id: user?.id ?? null,
        chat_id: chat?.id ?? null,
        username: user?.username ?? null,
        chat_type: chat?.type ?? null
      },
      null,
      2
    )
  );
}

run().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
