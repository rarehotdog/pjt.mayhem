#!/usr/bin/env node

const APP_BASE_URL = process.env.APP_BASE_URL ?? "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;
const KIND = process.argv[2];

async function run() {
  const response = await fetch(`${APP_BASE_URL}/api/telegram/reminder/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(CRON_SECRET ? { Authorization: `Bearer ${CRON_SECRET}` } : {})
    },
    body: JSON.stringify(
      KIND === "morning_plan" || KIND === "evening_review"
        ? {
            kind: KIND
          }
        : {}
    )
  });

  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`reminder run failed (${response.status}): ${JSON.stringify(json)}`);
  }

  console.log(JSON.stringify(json, null, 2));
}

run().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
