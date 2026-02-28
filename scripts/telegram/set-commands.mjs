#!/usr/bin/env node

const BOT_ID = process.argv[2] ?? process.env.TELEGRAM_SCRIPT_BOT_ID ?? "tyler_durden";

const BOT_ENV_KEYS = {
  tyler_durden: {
    token: process.env.TELEGRAM_BOT_COS_TOKEN ?? process.env.TELEGRAM_BOT_TOKEN
  },
  zhuge_liang: {
    token: process.env.TELEGRAM_BOT_LENS_TOKEN
  },
  jensen_huang: {
    token: process.env.TELEGRAM_BOT_BOLT_TOKEN
  },
  hemingway_ernest: {
    token: process.env.TELEGRAM_BOT_INK_TOKEN
  },
  alfred_sentry: {
    token: process.env.TELEGRAM_BOT_SENTRY_TOKEN
  }
};

if (!BOT_ENV_KEYS[BOT_ID]) {
  console.error(`[ERROR] unknown bot id: ${BOT_ID}`);
  process.exit(1);
}

const BOT_TOKEN = BOT_ENV_KEYS[BOT_ID].token;
if (!BOT_TOKEN) {
  console.error(`[ERROR] bot token is missing for ${BOT_ID}`);
  process.exit(1);
}

const TELEGRAM_API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

const commands = [
  { command: "start", description: "비서 시작 및 안내" },
  { command: "help", description: "명령어 보기" },
  { command: "pause", description: "자동 리마인드 중지" },
  { command: "resume", description: "자동 리마인드 재개" },
  { command: "summary", description: "최근 대화 요약" },
  { command: "daily", description: "모닝 브리핑" },
  { command: "review", description: "이브닝 리뷰" },
  { command: "panel", description: "자동 회의 모드 안내" },
  { command: "check", description: "SENTRY 점검" },
  { command: "cost", description: "비용 상태 요약" },
  { command: "ops", description: "자동 운영 플로우 상태" },
  { command: "mayhem", description: "단체 회의 소집 메시지" },
  { command: "approve", description: "외부행동 승인" },
  { command: "reject", description: "외부행동 거절" }
];

async function setCommands() {
  const response = await fetch(`${TELEGRAM_API_BASE}/setMyCommands`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      commands
    })
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json?.ok) {
    throw new Error(
      `setMyCommands failed (${response.status}): ${json?.description ?? "unknown error"}`
    );
  }
  console.log(`[PASS] Telegram commands configured for ${BOT_ID}`);
}

setCommands().catch((caught) => {
  const message = caught instanceof Error ? caught.message : String(caught);
  console.error(`[ERROR] ${message}`);
  process.exit(1);
});
