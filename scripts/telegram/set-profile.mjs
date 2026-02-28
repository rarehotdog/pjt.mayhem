#!/usr/bin/env node

const REQUESTED_BOT_ID = process.argv[2] ?? process.env.TELEGRAM_SCRIPT_BOT_ID ?? "tyler_durden";
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

const BOT_META = {
  tyler_durden: {
    token: readEnv("TELEGRAM_BOT_COS_TOKEN", "TELEGRAM_BOT_TOKEN"),
    name: "Tyler.Durden",
    description: "오케스트레이터. 결정과 라우팅을 담당합니다.",
    shortDescription: "Chief orchestrator bot"
  },
  zhuge_liang: {
    token: readEnv("TELEGRAM_BOT_LENS_TOKEN"),
    name: "제갈량",
    description: "LENS 분석관. 근거 기반 분석과 팩트체크를 담당합니다.",
    shortDescription: "LENS analyst bot"
  },
  jensen_huang: {
    token: readEnv("TELEGRAM_BOT_BOLT_TOKEN"),
    name: "Jensen Huang",
    description: "BOLT 실행/마감 담당. 태스크와 일정 추적을 수행합니다.",
    shortDescription: "BOLT execution bot"
  },
  hemingway_ernest: {
    token: readEnv("TELEGRAM_BOT_INK_TOKEN"),
    name: "Hemingway, Ernest",
    description: "INK 콘텐츠/바이럴 담당. 스레드와 카피 생성을 수행합니다.",
    shortDescription: "INK content bot"
  },
  michael_corleone: {
    token: readEnv("TELEGRAM_BOT_CORLEONE_TOKEN", "TELEGRAM_BOT_SENTRY_TOKEN"),
    name: "Michael Corleone",
    description: "SENTRY QA/보안/비용 게이트 담당 봇입니다.",
    shortDescription: "SENTRY quality gate bot"
  }
};

const meta = BOT_META[BOT_ID];
if (!meta) {
  console.error(`[ERROR] unknown bot id: ${REQUESTED_BOT_ID}`);
  process.exit(1);
}
if (BOT_ID !== REQUESTED_BOT_ID) {
  console.log(`[INFO] bot alias mapped: ${REQUESTED_BOT_ID} -> ${BOT_ID}`);
}
if (!meta.token) {
  console.error(`[ERROR] bot token is missing for ${BOT_ID}`);
  process.exit(1);
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${meta.token}`;

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
}

async function run() {
  await callTelegram("setMyName", {
    name: meta.name
  });
  await callTelegram("setMyDescription", {
    description: meta.description
  });
  await callTelegram("setMyShortDescription", {
    short_description: meta.shortDescription
  });
  console.log(`[PASS] bot profile updated for ${BOT_ID}`);
}

run().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
