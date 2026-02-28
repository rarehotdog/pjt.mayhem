#!/usr/bin/env node

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const FLOW = process.argv[2] ?? "market_3h";
const MODE = process.argv[3] ?? process.env.OPS_RUN_MODE ?? "cloud";
const CHAT_ID = process.env.OPS_RUN_CHAT_ID ? Number(process.env.OPS_RUN_CHAT_ID) : undefined;

async function run() {
  const response = await fetch(`${APP_BASE_URL}/api/telegram/ops/run/${FLOW}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {})
    },
    body: JSON.stringify({
      mode: MODE,
      ...(Number.isInteger(CHAT_ID) ? { chatId: CHAT_ID } : {})
    })
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`ops run failed (${response.status}): ${JSON.stringify(json)}`);
  }

  console.log(JSON.stringify(json, null, 2));
}

run().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
