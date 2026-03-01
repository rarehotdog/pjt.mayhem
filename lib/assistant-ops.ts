import { getAssistantBotDisplayName, normalizeAssistantBotId } from "@/lib/assistant-bots";
import { getAssistantConfig, type AssistantConfig } from "@/lib/assistant-config";
import { buildCompactNewsPrompt } from "@/lib/assistant-format";
import { generateAssistantReply } from "@/lib/assistant-llm";
import {
  appendAssistantCostLog,
  enqueueAssistantLocalJob,
  markAssistantUpdateStatus,
  reserveAssistantUpdate
} from "@/lib/assistant-store";
import { sendTelegramMessage } from "@/lib/telegram";
import type { AssistantBotId, AssistantDispatchMode, OpsFlowId } from "@/lib/assistant-types";
import { getLocalDateParts, sanitizeErrorMessage } from "@/lib/assistant-utils";

const AUTOPILOT_INTERRUPTS = [
  "태현님, 지금 뭘 피하고 있어?",
  "지난 2시간을 녹화했다면, 원하는 삶을 살고 있다고 보일까?",
  "지금 이 행동은 Anti-Vision 쪽인가, Vision 쪽인가?",
  "오늘 가장 중요한데 안 중요한 척하는 게 뭐야?",
  "오늘 가장 살아있다고 느낀 순간은?",
  "이건 정체성 보호인가, 진짜 원하는 건가?"
];

const MONTHLY_EXCAVATION_QUESTIONS = [
  "① 지난 달, 가장 참고 살았던 불만족은?",
  "② 반복 불평했지만 안 바꾼 것 3가지는?",
  "③ 각 불평에서 행동만 보면 실제로 무엇을 원했나?",
  "④ 존경하는 사람에게 차마 말 못할 현재 삶의 진실은?",
  "⑤ Anti-Vision 업데이트가 필요한가?",
  "⑥ 이번 달 가장 큰 승리와 가장 큰 회피는?"
];

const S4_WEEKDAY_CURRICULUM: Record<string, { topic: string; question: string }> = {
  Mon: {
    topic: "전략·의사결정",
    question: "이 결정에서 내 편향은 뭐지?"
  },
  Tue: {
    topic: "리더십·권력",
    question: "내가 권력을 원하는 진짜 이유는?"
  },
  Wed: {
    topic: "기술·시스템",
    question: "이 기술이 세상을 어떻게 재편하는가?"
  },
  Thu: {
    topic: "부·금융",
    question: "돈은 도구인가, 스코어보드인가?"
  },
  Fri: {
    topic: "설득·커뮤니케이션",
    question: "내 글이 진실을 전하는가, 이미지를 전하는가?"
  },
  Sat: {
    topic: "역사·문명",
    question: "제국은 왜 무너지는가? 내 시스템은?"
  },
  Sun: {
    topic: "철학·의식",
    question: "나는 누구인가? 이 모든 목표 너머에 뭐가 있는가?"
  }
};

const OPS_FLOW_UPDATE_CODE: Record<OpsFlowId, number> = {
  market_3h: 11,
  gmat_mba_daily: 12,
  finance_event_daily: 13,
  world_knowledge_daily: 14,
  hv_cycle_5d: 15,
  product_wbs_daily: 16,
  cost_guard_daily: 17,
  agent_retrospective_weekly: 18,
  autopilot_interrupt_daily: 41,
  psych_excavation_monthly: 42,
  game_score_monthly: 43
};

export const OPS_FLOW_IDS: OpsFlowId[] = [
  "market_3h",
  "gmat_mba_daily",
  "finance_event_daily",
  "world_knowledge_daily",
  "hv_cycle_5d",
  "product_wbs_daily",
  "cost_guard_daily",
  "agent_retrospective_weekly",
  "autopilot_interrupt_daily",
  "psych_excavation_monthly",
  "game_score_monthly"
];

interface OpsFlowSpec {
  id: OpsFlowId;
  ownerBotId: AssistantBotId;
  title: string;
  cadence: string;
  purpose: string;
}

const OPS_FLOW_SPECS: Record<OpsFlowId, OpsFlowSpec> = {
  market_3h: {
    id: "market_3h",
    ownerBotId: "zhuge_liang",
    title: "시장/국제 뉴스 3시간 브리핑",
    cadence: "Mac launchd (every 3h) + Vercel backup (daily)",
    purpose: "주식 시황 + 국제 이슈 + watchlist를 짧게 정리"
  },
  gmat_mba_daily: {
    id: "gmat_mba_daily",
    ownerBotId: "zhuge_liang",
    title: "GMAT/MBA 이벤트 데일리",
    cadence: "Daily (Vercel cron)",
    purpose: "시험/세션/지원 마감 체크와 일정 정리"
  },
  finance_event_daily: {
    id: "finance_event_daily",
    ownerBotId: "zhuge_liang",
    title: "금융 지식/이벤트 데일리",
    cadence: "Daily (Vercel cron)",
    purpose: "금융 개념 1개 + 새 이벤트 요약"
  },
  world_knowledge_daily: {
    id: "world_knowledge_daily",
    ownerBotId: "zhuge_liang",
    title: "S4 제왕의 수업",
    cadence: "Daily (Vercel cron)",
    purpose: "주간 커리큘럼 기반 제왕 수업 5줄 브리핑"
  },
  hv_cycle_5d: {
    id: "hv_cycle_5d",
    ownerBotId: "hemingway_ernest",
    title: "헤픈인벨리 5일 발행 사이클",
    cadence: "Every 5 days (Vercel cron)",
    purpose: "주제/훅/CTA와 발행 준비 상태 정리"
  },
  product_wbs_daily: {
    id: "product_wbs_daily",
    ownerBotId: "jensen_huang",
    title: "AI 프로덕트 WBS 데일리",
    cadence: "Daily (Vercel cron)",
    purpose: "Codex 작업 단위와 마감/DoD 정리"
  },
  cost_guard_daily: {
    id: "cost_guard_daily",
    ownerBotId: "michael_corleone",
    title: "토큰 비용 가드 점검",
    cadence: "Twice daily (Vercel cron)",
    purpose: "비용/호출량/중복 호출 리스크 점검"
  },
  agent_retrospective_weekly: {
    id: "agent_retrospective_weekly",
    ownerBotId: "michael_corleone",
    title: "에이전트 자가개선 회고",
    cadence: "Weekly (Vercel cron)",
    purpose: "주간 오작동/개선안 정리"
  },
  autopilot_interrupt_daily: {
    id: "autopilot_interrupt_daily",
    ownerBotId: "jensen_huang",
    title: "Autopilot Interrupt",
    cadence: "Hourly check (11:00~21:00 KST, once/day)",
    purpose: "회피 패턴을 끊는 랜덤 인터럽트 1회 전송"
  },
  psych_excavation_monthly: {
    id: "psych_excavation_monthly",
    ownerBotId: "tyler_durden",
    title: "월간 심리 발굴",
    cadence: "Monthly (1st day 08:00 KST)",
    purpose: "Tyler DM 6문항 심리 발굴 프로토콜"
  },
  game_score_monthly: {
    id: "game_score_monthly",
    ownerBotId: "tyler_durden",
    title: "월말 GAME SCORE CARD",
    cadence: "Monthly (last day 22:00 KST)",
    purpose: "M1~Mx 진행률 및 다음 달 Boss Fight 정리"
  }
};

function deterministicHash(input: string) {
  let hash = 0;
  for (const ch of input) {
    hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function resolveMayhemChatId(config = getAssistantConfig()) {

  if (typeof config.telegramMayhemChatId === "number") {
    return config.telegramMayhemChatId;
  }

  const allowlistedChats = Array.from(config.telegramAllowedChatIds);
  const groupChat = allowlistedChats.find((chatId) => chatId < 0);
  return typeof groupChat === "number" ? groupChat : undefined;
}

function resolveTylerDmChatId(config = getAssistantConfig()) {
  if (typeof config.telegramTylerDmChatId === "number") {
    return config.telegramTylerDmChatId;
  }
  return undefined;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalWeekday(timezone: string, now: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short"
  }).format(now);
}

function isLastDayOfLocalMonth(timezone: string, now: Date) {
  const today = getLocalDateParts(timezone, now).dateKey;
  const tomorrow = getLocalDateParts(timezone, new Date(now.getTime() + 24 * 60 * 60 * 1000)).dateKey;
  return today.slice(0, 7) !== tomorrow.slice(0, 7);
}

function resolveAutopilotTargetHour(dateKey: string) {
  return 11 + (deterministicHash(dateKey) % 11);
}

function buildWorldKnowledgePrompt(now: Date, timezone: string) {
  const weekday = getLocalWeekday(timezone, now);
  const curriculum = S4_WEEKDAY_CURRICULUM[weekday] ?? S4_WEEKDAY_CURRICULUM.Sun;

  return [
    "업무: S4 제왕의 수업 — 단계 상승 훈련 (자아 발달 5→7단계)",
    `오늘 커리큘럼: ${curriculum.topic}`,
    `핵심 질문: \"${curriculum.question}\"`,
    "출력 규칙:",
    "- 5줄 이내",
    "- 핵심 인물 1명 + 교훈 1줄 + 질문 1개",
    "- 마지막 줄은 내일 행동 1개",
    "- 과장/단정 금지"
  ].join("\n");
}

function buildOpsPrompt(flow: OpsFlowId, now: Date, timezone: string) {
  const config = getAssistantConfig();
  if (flow === "market_3h") {
    return buildCompactNewsPrompt({
      title: "시장/국제 뉴스 3시간 브리핑",
      now,
      timezone,
      count: config.newsDefaultCount,
      contextFocus: [
        "국내+해외 시장 이슈를 균형 있게 선정",
        "지수/금리/환율/원자재 변동의 리스크온·오프 신호 정리",
        "이번 주말~다음 거래일 헤드라인 리스크 점검",
        "마지막 종합 정리는 시장 시사점 중심으로 압축"
      ]
    });
  }

  if (flow === "world_knowledge_daily") {
    return buildWorldKnowledgePrompt(now, timezone);
  }

  const local = getLocalDateParts(timezone, now);
  const slot = `${local.dateKey} ${pad2(local.hour)}:${pad2(local.minute)} ${timezone}`;

  const common = [
    `현재 실행 슬롯: ${slot}`,
    "출력 규칙:",
    "- 8줄 이내",
    "- FACT/ASSUMPTION/TODO-VERIFY 라벨 유지",
    "- 마지막 줄은 '다음 액션 1개'",
    "- 불확실한 최신 수치/뉴스는 단정 금지"
  ];

  const perFlow: Record<OpsFlowId, string[]> = {
    market_3h: [
      "업무: 시황/국제 뉴스 브리핑",
      "형식: 시장 2줄 + 국제이슈 2줄 + watchlist 2개 + 리스크 1줄"
    ],
    gmat_mba_daily: [
      "업무: GMAT 및 MBA 세션/이벤트 체크",
      "형식: 핵심 일정 3개 + 신청 필요 항목 1개 + '사용자 승인 필요' 명시"
    ],
    finance_event_daily: [
      "업무: 금융 지식/이벤트 데일리 카드",
      "형식: 개념 1개 + 오늘 이벤트 2개 + 투자 유의 1줄"
    ],
    world_knowledge_daily: ["업무: S4 제왕의 수업", "형식: 인물 1명 + 교훈 1줄 + 질문 1개"],
    hv_cycle_5d: [
      "업무: 헤픈인벨리 5일 발행 준비",
      "형식: 주제 1개 + 훅 1개 + CTA 1개 + 필요한 팩트체크 1개"
    ],
    product_wbs_daily: [
      "업무: AI 프로덕트 개발 WBS",
      "형식: 오늘 Codex 작업 3개(각 DoD 포함) + 차단요인 1개"
    ],
    cost_guard_daily: [
      "업무: 비용 가드 점검",
      "형식: 비용 리스크 2개 + 차단 룰 2개 + 경량모드 전환 조건 1개"
    ],
    agent_retrospective_weekly: [
      "업무: 에이전트 자가개선 회고",
      "형식: 이번주 문제 3개 + 개선 실험 2개 + 다음주 측정지표 1개"
    ],
    autopilot_interrupt_daily: [
      "업무: Autopilot Interrupt",
      "형식: 질문 1개 + 즉시 행동 1개 제안 (3줄 이내)"
    ],
    psych_excavation_monthly: ["업무: 월간 심리 발굴", "형식: 6문항 고정 질문 전송"],
    game_score_monthly: [
      "업무: 월말 GAME SCORE CARD",
      "형식: 미션 진행률 + LEVEL UP + BOSS MISS + 다음달 Boss Fight"
    ]
  };

  return [...perFlow[flow], ...common].join("\n");
}

function buildOpsHeader(flow: OpsFlowId, now: Date, timezone: string) {
  const spec = OPS_FLOW_SPECS[flow];
  const local = getLocalDateParts(timezone, now);
  const timestamp = `${local.dateKey} ${pad2(local.hour)}:${pad2(local.minute)}`;
  return `🧠 ${spec.title} (${timestamp} ${timezone})`;
}

function getMention(botId: AssistantBotId): string {
  const config = getAssistantConfig();
  const username = config.telegramBots[normalizeAssistantBotId(botId)]?.username;
  return username ? `@${username}` : getAssistantBotDisplayName(botId);
}

export function isOpsFlowId(value: string | null | undefined): value is OpsFlowId {
  return Boolean(value && OPS_FLOW_IDS.includes(value as OpsFlowId));
}

export function listOpsFlowSpecs() {
  return OPS_FLOW_IDS.map((flowId) => OPS_FLOW_SPECS[flowId]);
}

export function buildOpsStatusMessage(languageCode?: string | null) {
  const lines = ["🤖 자동 운영 플로우", ""];

  for (const flow of listOpsFlowSpecs()) {
    const owner = getAssistantBotDisplayName(flow.ownerBotId, languageCode);
    lines.push(`- ${flow.id}: ${flow.title} | owner=${owner} | cadence=${flow.cadence}`);
  }

  lines.push("", "실행 API: /api/telegram/ops/run/[flow] (mode=cloud|local_queue)");
  return lines.join("\n");
}

export function buildMayhemKickoffMessage(timezone: string) {
  const now = new Date();
  const local = getLocalDateParts(timezone, now);
  const timestamp = `${local.dateKey} ${pad2(local.hour)}:${pad2(local.minute)}`;

  return [
    `🧩 MAYHEM 회의 시작 (${timestamp} ${timezone})`,
    `${getMention("zhuge_liang")} : GMAT/MBA + 시장 핵심 업데이트 5줄`,
    `${getMention("jensen_huang")} : 오늘 실행 태스크 3개(DoD 포함)`,
    `${getMention("hemingway_ernest")} : 발행 주제/훅/CTA 1세트`,
    `${getMention("michael_corleone")} : 비용/리스크 경고 2개 + 차단안 1개`,
    "Tyler.Durden이 최종 결정 1개 + 액션 3개로 마감합니다."
  ].join("\n");
}

async function reserveFlowExecutionSlot(
  flowId: OpsFlowId,
  botId: AssistantBotId,
  now: Date,
  timezone: string
) {
  const local = getLocalDateParts(timezone, now);
  const dateNumber = Number(local.dateKey.replaceAll("-", ""));
  const updateId = dateNumber * 100 + OPS_FLOW_UPDATE_CODE[flowId];

  try {
    const reserved = await reserveAssistantUpdate({
      botId,
      updateId,
      source: "manual",
      status: "received"
    });
    return {
      reserved: reserved.reserved,
      updateId
    };
  } catch {
    return {
      reserved: true,
      updateId
    };
  }
}

async function markFlowExecutionStatus(
  updateId: number,
  botId: AssistantBotId,
  status: string,
  error?: string
) {
  await markAssistantUpdateStatus(updateId, status, error, botId).catch(() => undefined);
}

async function sendTylerDirectWithFallback(options: {
  config: AssistantConfig;
  botId: AssistantBotId;
  text: string;
  disableNotification?: boolean;
}) {
  const dmChatId = resolveTylerDmChatId(options.config);
  const mayhemChatId = resolveMayhemChatId(options.config);

  if (typeof dmChatId === "number") {
    try {
      await sendTelegramMessage({
        botId: options.botId,
        chatId: dmChatId,
        text: options.text,
        disableNotification: options.disableNotification ?? true
      });
      return {
        chatId: dmChatId,
        delivery: "dm" as const
      };
    } catch (caught) {
      if (typeof mayhemChatId === "number") {
        await sendTelegramMessage({
          botId: options.botId,
          chatId: mayhemChatId,
          text: `⚠️ Tyler DM 전송 실패로 그룹 fallback 전송\n\n${options.text}`,
          disableNotification: options.disableNotification ?? true
        });
        return {
          chatId: mayhemChatId,
          delivery: "group_fallback" as const,
          fallbackReason: sanitizeErrorMessage(caught)
        };
      }
      throw caught;
    }
  }

  if (typeof mayhemChatId === "number") {
    await sendTelegramMessage({
      botId: options.botId,
      chatId: mayhemChatId,
      text: `⚠️ TELEGRAM_TYLER_DM_CHAT_ID 미설정으로 그룹 fallback 전송\n\n${options.text}`,
      disableNotification: options.disableNotification ?? true
    });
    return {
      chatId: mayhemChatId,
      delivery: "group_fallback" as const,
      fallbackReason: "missing_tyler_dm_chat_id"
    };
  }

  throw new Error("No Tyler DM or MAYHEM fallback chat is configured.");
}

async function runAutopilotInterrupt(options: {
  flow: OpsFlowSpec;
  now: Date;
  config: AssistantConfig;
  source: string;
}) {
  const local = getLocalDateParts(options.config.assistantTimezone, options.now);

  if (local.hour < 11 || local.hour > 21) {
    return {
      ok: true,
      flow: options.flow.id,
      skipped: true,
      reason: "outside_kst_window",
      source: options.source
    };
  }

  const targetHour = resolveAutopilotTargetHour(local.dateKey);
  if (local.hour !== targetHour) {
    return {
      ok: true,
      flow: options.flow.id,
      skipped: true,
      reason: `waiting_target_hour_${targetHour}`,
      source: options.source
    };
  }

  const reserved = await reserveFlowExecutionSlot(
    options.flow.id,
    options.flow.ownerBotId,
    options.now,
    options.config.assistantTimezone
  );
  if (!reserved.reserved) {
    return {
      ok: true,
      flow: options.flow.id,
      skipped: true,
      reason: "already_sent_today",
      source: options.source
    };
  }

  const question = AUTOPILOT_INTERRUPTS[deterministicHash(local.dateKey) % AUTOPILOT_INTERRUPTS.length];
  const text = [
    `⚡ Autopilot Interrupt (${local.dateKey})`,
    `• ${question}`,
    "• 답변은 3줄 이내, 지금 바로 할 행동 1개까지 적어줘."
  ].join("\n");

  try {
    const delivery = await sendTylerDirectWithFallback({
      config: options.config,
      botId: options.flow.ownerBotId,
      text,
      disableNotification: true
    });

    await markFlowExecutionStatus(reserved.updateId, options.flow.ownerBotId, "processed");

    return {
      ok: true,
      flow: options.flow.id,
      ownerBotId: options.flow.ownerBotId,
      chatId: delivery.chatId,
      source: options.source,
      dispatchMode: "cloud" as const,
      sentAt: new Date().toISOString(),
      delivery: delivery.delivery,
      targetHour
    };
  } catch (caught) {
    const error = sanitizeErrorMessage(caught);
    await markFlowExecutionStatus(reserved.updateId, options.flow.ownerBotId, "failed", error);
    throw new Error(`autopilot interrupt failed: ${error}`);
  }
}

async function runPsychExcavationMonthly(options: {
  flow: OpsFlowSpec;
  now: Date;
  config: AssistantConfig;
  source: string;
}) {
  const local = getLocalDateParts(options.config.assistantTimezone, options.now);
  if (local.day !== 1) {
    return {
      ok: true,
      flow: options.flow.id,
      skipped: true,
      reason: "not_first_day_of_month",
      source: options.source
    };
  }

  const reserved = await reserveFlowExecutionSlot(
    options.flow.id,
    options.flow.ownerBotId,
    options.now,
    options.config.assistantTimezone
  );
  if (!reserved.reserved) {
    return {
      ok: true,
      flow: options.flow.id,
      skipped: true,
      reason: "already_sent_this_month_slot",
      source: options.source
    };
  }

  const text = [`🧠 월간 심리 발굴 (${local.year}-${pad2(local.month)})`, ...MONTHLY_EXCAVATION_QUESTIONS].join(
    "\n"
  );

  try {
    const delivery = await sendTylerDirectWithFallback({
      config: options.config,
      botId: options.flow.ownerBotId,
      text,
      disableNotification: true
    });
    await markFlowExecutionStatus(reserved.updateId, options.flow.ownerBotId, "processed");

    return {
      ok: true,
      flow: options.flow.id,
      ownerBotId: options.flow.ownerBotId,
      chatId: delivery.chatId,
      source: options.source,
      dispatchMode: "cloud" as const,
      sentAt: new Date().toISOString(),
      delivery: delivery.delivery
    };
  } catch (caught) {
    const error = sanitizeErrorMessage(caught);
    await markFlowExecutionStatus(reserved.updateId, options.flow.ownerBotId, "failed", error);
    throw new Error(`monthly excavation failed: ${error}`);
  }
}

async function runGameScoreMonthly(options: {
  flow: OpsFlowSpec;
  now: Date;
  config: AssistantConfig;
  source: string;
}) {
  if (!isLastDayOfLocalMonth(options.config.assistantTimezone, options.now)) {
    return {
      ok: true,
      flow: options.flow.id,
      skipped: true,
      reason: "not_last_day_of_month",
      source: options.source
    };
  }

  const reserved = await reserveFlowExecutionSlot(
    options.flow.id,
    options.flow.ownerBotId,
    options.now,
    options.config.assistantTimezone
  );
  if (!reserved.reserved) {
    return {
      ok: true,
      flow: options.flow.id,
      skipped: true,
      reason: "already_sent_this_month_slot",
      source: options.source
    };
  }

  const local = getLocalDateParts(options.config.assistantTimezone, options.now);
  const prompt = [
    `작업: 월말 GAME SCORE CARD 생성 (${local.year}-${pad2(local.month)})`,
    "언어: 한국어",
    "형식 고정:",
    "🎮 TYLER'S GAME SCORE — 2026년 [N]월",
    "🏆 MISSION STATUS",
    "M1 SCHOLAR / M2 WARRIOR / M3 MERCHANT / M4 BUILDER / M5 EMPEROR / Mx VOICE 각각 진행률 바",
    "📈 이번 달 LEVEL UP",
    "📉 이번 달 BOSS MISS",
    "🧠 DAN KOE CHECK (Anti-Vision 횟수, Vision 횟수, 정체성 변화 신호)",
    "🎯 다음 달 BOSS FIGHT 3개",
    "규칙:",
    "- 숫자/사실이 불확실하면 TODO-VERIFY로 표시",
    "- 과장/단정 금지",
    "- 22:00 이브닝 회고에 바로 붙일 수 있도록 간결하게 작성"
  ].join("\n");

  try {
    const response = await generateAssistantReply({
      botId: options.flow.ownerBotId,
      history: [],
      userText: prompt,
      timezone: options.config.assistantTimezone,
      maxOutputTokens: 520,
      temperature: 0.2
    });

    const delivery = await sendTylerDirectWithFallback({
      config: options.config,
      botId: options.flow.ownerBotId,
      text: response.outputText,
      disableNotification: true
    });

    if (response.provider !== "none") {
      await appendAssistantCostLog({
        botId: options.flow.ownerBotId,
        provider: response.provider,
        model: response.model,
        tokensIn: response.tokensIn ?? 0,
        tokensOut: response.tokensOut ?? 0,
        estimatedCostUsd: response.estimatedCostUsd ?? 0,
        path: `ops:${options.flow.id}`
      }).catch(() => undefined);
    }

    await markFlowExecutionStatus(reserved.updateId, options.flow.ownerBotId, "processed");

    return {
      ok: true,
      flow: options.flow.id,
      ownerBotId: options.flow.ownerBotId,
      chatId: delivery.chatId,
      source: options.source,
      dispatchMode: "cloud" as const,
      provider: response.provider,
      model: response.model,
      sentAt: new Date().toISOString(),
      delivery: delivery.delivery
    };
  } catch (caught) {
    const error = sanitizeErrorMessage(caught);
    await markFlowExecutionStatus(reserved.updateId, options.flow.ownerBotId, "failed", error);
    throw new Error(`game score monthly failed: ${error}`);
  }
}

export async function runOpsFlow(options: {
  flow: OpsFlowId;
  chatId?: number;
  now?: Date;
  source?: string;
  mode?: AssistantDispatchMode;
}) {
  const config = getAssistantConfig();
  const now = options.now ?? new Date();
  const flow = OPS_FLOW_SPECS[options.flow];
  const mode = options.mode ?? "cloud";
  const source = options.source ?? "ops_endpoint";

  if (flow.id === "autopilot_interrupt_daily") {
    return runAutopilotInterrupt({
      flow,
      now,
      config,
      source
    });
  }

  if (flow.id === "psych_excavation_monthly") {
    return runPsychExcavationMonthly({
      flow,
      now,
      config,
      source
    });
  }

  if (flow.id === "game_score_monthly") {
    return runGameScoreMonthly({
      flow,
      now,
      config,
      source
    });
  }

  const chatId = options.chatId ?? resolveMayhemChatId(config);
  if (!chatId) {
    throw new Error("No target chat found. Set TELEGRAM_MAYHEM_CHAT_ID or TELEGRAM_ALLOWED_CHAT_IDS.");
  }

  const prompt = buildOpsPrompt(flow.id, now, config.assistantTimezone);
  const header = buildOpsHeader(flow.id, now, config.assistantTimezone);

  if (mode === "local_queue") {
    const job = await enqueueAssistantLocalJob({
      flowId: flow.id,
      botId: flow.ownerBotId,
      chatId,
      mode: "local_heavy",
      payload: {
        taskType: "ops_flow",
        prompt,
        header,
        timezone: config.assistantTimezone,
        fallbackMode: "cloud"
      }
    });

    return {
      ok: true,
      flow: flow.id,
      ownerBotId: flow.ownerBotId,
      chatId,
      source,
      dispatchMode: mode,
      jobId: job.jobId,
      sentAt: new Date().toISOString()
    };
  }

  const response = await generateAssistantReply({
    botId: flow.ownerBotId,
    history: [],
    userText: prompt,
    timezone: config.assistantTimezone,
    maxOutputTokens: 360,
    temperature: 0.3
  });

  const text = [header, response.outputText].join("\n\n");

  await sendTelegramMessage({
    botId: flow.ownerBotId,
    chatId,
    text,
    disableNotification: true
  });

  if (response.provider !== "none") {
    await appendAssistantCostLog({
      botId: flow.ownerBotId,
      provider: response.provider,
      model: response.model,
      tokensIn: response.tokensIn ?? 0,
      tokensOut: response.tokensOut ?? 0,
      estimatedCostUsd: response.estimatedCostUsd ?? 0,
      path: `ops:${flow.id}`
    }).catch(() => undefined);
  }

  return {
    ok: true,
    flow: flow.id,
    ownerBotId: flow.ownerBotId,
    chatId,
    provider: response.provider,
    model: response.model,
    dispatchMode: mode,
    source,
    sentAt: new Date().toISOString()
  };
}

export function __private_buildOpsPrompt(flow: OpsFlowId, now: Date, timezone: string) {
  return buildOpsPrompt(flow, now, timezone);
}
