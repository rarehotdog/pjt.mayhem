import { getAssistantBotDisplayName } from "@/lib/assistant-bots";
import { getAssistantConfig } from "@/lib/assistant-config";
import { generateAssistantReply } from "@/lib/assistant-llm";
import { appendAssistantCostLog, enqueueAssistantLocalJob } from "@/lib/assistant-store";
import { sendTelegramMessage } from "@/lib/telegram";
import type { AssistantBotId, AssistantDispatchMode, OpsFlowId } from "@/lib/assistant-types";
import { getLocalDateParts } from "@/lib/assistant-utils";

export const OPS_FLOW_IDS: OpsFlowId[] = [
  "market_3h",
  "gmat_mba_daily",
  "finance_event_daily",
  "world_knowledge_daily",
  "hv_cycle_5d",
  "product_wbs_daily",
  "cost_guard_daily",
  "agent_retrospective_weekly"
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
    ownerBotId: "tyler_durden",
    title: "World-Class 지식 카드",
    cadence: "Daily (Vercel cron)",
    purpose: "리더십/전략/시스템 사고 핵심 전달"
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
    ownerBotId: "alfred_sentry",
    title: "토큰 비용 가드 점검",
    cadence: "Twice daily (Vercel cron)",
    purpose: "비용/호출량/중복 호출 리스크 점검"
  },
  agent_retrospective_weekly: {
    id: "agent_retrospective_weekly",
    ownerBotId: "alfred_sentry",
    title: "에이전트 자가개선 회고",
    cadence: "Weekly (Vercel cron)",
    purpose: "주간 오작동/개선안 정리"
  }
};

function resolveMayhemChatId() {
  const config = getAssistantConfig();

  if (typeof config.telegramMayhemChatId === "number") {
    return config.telegramMayhemChatId;
  }

  const allowlistedChats = Array.from(config.telegramAllowedChatIds);
  const groupChat = allowlistedChats.find((chatId) => chatId < 0);
  return typeof groupChat === "number" ? groupChat : undefined;
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function buildOpsPrompt(flow: OpsFlowId, now: Date, timezone: string) {
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
    world_knowledge_daily: [
      "업무: 세계 최고 수준 실행을 위한 지식 카드",
      "형식: 원칙 1개 + 사례 1개 + 오늘 적용법 1개"
    ],
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
  const username = config.telegramBots[botId]?.username;
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
    `${getMention("alfred_sentry")} : 비용/리스크 경고 2개 + 차단안 1개`,
    "Tyler.Durden이 최종 결정 1개 + 액션 3개로 마감합니다."
  ].join("\n");
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

  const chatId = options.chatId ?? resolveMayhemChatId();
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
      source: options.source ?? "ops_endpoint",
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
      source: options.source ?? "ops_endpoint",
      sentAt: new Date().toISOString()
    };
}
