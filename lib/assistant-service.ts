import {
  getAssistantBotDisplayName,
  normalizeAssistantBotId,
  getAssistantTeamDisplayLines,
} from "@/lib/assistant-bots";
import { getAssistantConfig, isAllowlisted, type AssistantConfig } from "@/lib/assistant-config";
import {
  buildCompactNewsFallback,
  buildWarRoomBriefingPrompt,
  buildWarRoomBriefingTemplate
} from "@/lib/assistant-format";
import { buildMayhemKickoffMessage, buildOpsStatusMessage } from "@/lib/assistant-ops";
import {
  generateAssistantReply,
  generateConversationSummary,
  type AssistantGenerationInput
} from "@/lib/assistant-llm";
import { isRateLimited } from "@/lib/assistant-rate-limit";
import {
  appendAssistantCostLog,
  appendAssistantMessage,
  createAssistantActionApproval,
  createReminderJobIfNotExists,
  enqueueAssistantLocalJob,
  getAssistantActionApproval,
  listRecentAssistantMessages,
  listReminderTargets,
  markAssistantUpdateStatus,
  markReminderJobStatus,
  reserveAssistantUpdate,
  setAssistantReminderPaused,
  summarizeAssistantCostsLast24h,
  touchAssistantThread,
  updateThreadSummary,
  updateAssistantActionApprovalStatus,
  upsertAssistantUser
} from "@/lib/assistant-store";
import { sendTelegramMessage } from "@/lib/telegram";
import type {
  AssistantBotId,
  AssistantCanonicalBotId,
  AssistantProviderName,
  AssistantUpdateSource,
  ReminderJobKind,
  TelegramUpdate
} from "@/lib/assistant-types";
import {
  buildReminderMessage,
  buildThreadId,
  getLocalDateParts,
  normalizeCommand,
  parseReminderKind,
  resolveReminderKindByHour,
  sanitizeErrorMessage,
  truncateText
} from "@/lib/assistant-utils";

const FALLBACK_REPLY =
  "지금 응답 생성에 문제가 있어요. 잠시 후 다시 질문해 주세요. 원하시면 핵심 질문 1개만 짧게 보내주시면 우선순위부터 정리해드릴게요.";
const GROUP_PANEL_COOLDOWN_MS = 90_000;
const groupPanelCooldownByChat = new Map<number, number>();
const groupPanelRoundDedupByChat = new Map<number, string>();
const LOCAL_QUEUE_NOTICE =
  "이 요청은 로컬 고성능 워커로 넘겨 처리합니다. 완료되면 같은 방에 결과를 이어서 보낼게요.";
const MISSION_CODES = ["M1", "M2", "M3", "M4", "M5", "Mx"] as const;
type MissionCode = (typeof MISSION_CODES)[number];
type FocusWeights = Record<MissionCode, number>;
const DEFAULT_FOCUS_WEIGHTS: FocusWeights = {
  M1: 35,
  M2: 15,
  M3: 10,
  M4: 15,
  M5: 10,
  Mx: 15
};
const THREAD_FOCUS_STATE = new Map<string, FocusWeights>();

const COMMAND_LINES = [
  "/start - 비서 시작 및 안내",
  "/help - 명령어 보기",
  "/pause - 자동 리마인드 중지",
  "/resume - 자동 리마인드 재개",
  "/summary - 최근 대화 요약",
  "/daily - 모닝 브리핑",
  "/review - 이브닝 리뷰",
  "/focus - 미션 가중치 설정/조회",
  "/panel - 자동 회의 모드 안내",
  "/check - SENTRY 점검",
  "/cost - 비용 상태 요약",
  "/ops - 자동 운영 플로우 상태",
  "/mayhem - 단체 회의 소집 메시지",
  "/approve <id> - 외부행동 승인",
  "/reject <id> - 외부행동 거절"
];

function buildHelpMessage(languageCode?: string | null) {
  return [
    "사용 가능한 명령어",
    ...COMMAND_LINES,
    "",
    "현재 5봇 팀",
    ...getAssistantTeamDisplayLines(languageCode)
  ].join("\n");
}

function buildStartMessage(
  botId: AssistantBotId,
  firstName?: string,
  languageCode?: string | null
) {
  const prefix = firstName ? `${firstName}님,` : "안녕하세요,";
  const botName = getAssistantBotDisplayName(botId, languageCode);
  return [
    `${prefix} ${botName} 연결이 완료되었습니다.`,
    "메시지를 보내면 OpenAI 우선, Claude 백업으로 답변합니다.",
    "리마인드는 기본 하루 2회(아침/저녁)로 동작합니다.",
    "",
    buildHelpMessage(languageCode)
  ].join("\n");
}

function buildCompactBriefingPrompt(
  kind: ReminderJobKind,
  timezone: string,
  newsCount: number,
  now = new Date()
) {
  if (kind === "morning_plan") {
    return buildWarRoomBriefingPrompt({
      kind,
      title: "모닝 브리핑 (/daily)",
      now,
      timezone,
      count: newsCount,
      contextFocus: [
        "개장 전/장중 핵심 이슈와 타임센서티브 이벤트",
        "국내+해외 리스크온/오프 신호",
        "당일 체크해야 할 금리/환율/원자재 포인트"
      ]
    });
  }

  return buildWarRoomBriefingPrompt({
    kind,
    title: "이브닝 리뷰 (/review)",
    now,
    timezone,
    count: newsCount,
    contextFocus: [
      "마감 후 핵심 이벤트와 다음 거래일 갭 리스크",
      "정책/실적/지정학 헤드라인의 시장 영향",
      "다음 날 우선 추적할 체크포인트"
    ]
  });
}

function buildCompactBriefingFallback(kind: ReminderJobKind, newsCount: number) {
  return [
    `⚠️ ${buildCompactNewsFallback(kind)}`,
    "",
    buildWarRoomBriefingTemplate({
      kind,
      count: newsCount
    })
  ].join("\n");
}

async function buildCompactBriefingResponse(options: {
  botId: AssistantBotId;
  timezone: string;
  kind: ReminderJobKind;
}): Promise<AssistantResponsePayload> {
  const config = getAssistantConfig();
  const prompt = buildCompactBriefingPrompt(
    options.kind,
    options.timezone,
    config.newsDefaultCount
  );

  try {
    const result = await generateAssistantReply({
      botId: options.botId,
      history: [],
      userText: prompt,
      timezone: options.timezone,
      maxOutputTokens: 900,
      temperature: 0.2
    });

    return {
      text: result.outputText,
      provider: result.provider,
      model: result.model,
      metadata: {
        fallbackFrom: result.fallbackFrom,
        providerError: result.error,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        estimatedCostUsd: result.estimatedCostUsd,
        ...(result.metadata ?? {})
      }
    };
  } catch (caught) {
    return {
      text: buildCompactBriefingFallback(options.kind, config.newsDefaultCount),
      provider: "none",
      model: "briefing-fallback",
      metadata: {
        error: sanitizeErrorMessage(caught)
      }
    };
  }
}

function buildPanelMessage(languageCode?: string | null) {
  const cos = getAssistantBotDisplayName("tyler_durden", languageCode);
  const speakers = [
    getAssistantBotDisplayName("zhuge_liang", languageCode),
    getAssistantBotDisplayName("jensen_huang", languageCode),
    getAssistantBotDisplayName("hemingway_ernest", languageCode),
    getAssistantBotDisplayName("michael_corleone", languageCode)
  ].join(" / ");

  return [
    `🎤 자동 회의 모드`,
    `${cos}가 기본 의장을 맡고, 필요 시 최대 3봇까지 발화합니다.`,
    `참여 후보: ${speakers}`,
    "그룹방 자동 회의는 90초 쿨다운이 적용됩니다."
  ].join("\n");
}

function buildSentryCheckMessage(languageCode?: string | null) {
  const sentry = getAssistantBotDisplayName("michael_corleone", languageCode);
  return [
    `🛡️ ${sentry} 점검`,
    "- FACT/ASSUMPTION/TODO-VERIFY 라벨 확인",
    "- 과장/환각/보안 리스크 점검",
    "- 비용 게이트 통과 여부 점검"
  ].join("\n");
}

async function buildCostMessage(languageCode?: string | null) {
  const sentry = getAssistantBotDisplayName("michael_corleone", languageCode);
  const config = getAssistantConfig();
  const summary = await summarizeAssistantCostsLast24h().catch(() => null);
  if (!summary) {
    return [
      `💸 ${sentry} 비용 요약`,
      "비용 로그 테이블이 아직 준비되지 않아 집계를 표시할 수 없습니다.",
      "마이그레이션 적용 후 다시 /cost 를 실행해 주세요."
    ].join("\n");
  }
  const riskByCost = summary.totalCostUsd >= config.dailyCostCapUsd;
  const riskByTokens = summary.totalTokens >= config.dailyTokenCap;
  const risk = riskByCost || riskByTokens;

  const topBots = summary.byBot
    .sort((a, b) => b.costUsd - a.costUsd)
    .slice(0, 3)
    .map((item) => `- ${getAssistantBotDisplayName(item.botId, languageCode)}: $${item.costUsd.toFixed(4)} / ${item.tokens.toLocaleString()} tokens (${item.calls} calls)`);

  return [
    `💸 ${sentry} 비용 요약 (최근 24h)`,
    `총 비용: $${summary.totalCostUsd.toFixed(4)} / cap $${config.dailyCostCapUsd.toFixed(2)}`,
    `총 토큰: ${summary.totalTokens.toLocaleString()} / cap ${config.dailyTokenCap.toLocaleString()}`,
    `상태: ${risk ? "⚠️ 경량 모드 권장" : "✅ 정상"}`,
    topBots.length > 0 ? "봇별 상위 사용량:" : "아직 비용 로그가 없습니다.",
    ...topBots
  ].join("\n");
}

export interface AssistantResponsePayload {
  text: string;
  provider: AssistantProviderName;
  model?: string;
  metadata?: Record<string, unknown>;
}

function commandToStatus(command: string) {
  if (command === "/pause") {
    return "paused";
  }
  if (command === "/resume") {
    return "resumed";
  }
  if (command === "/approve") {
    return "approved";
  }
  if (command === "/reject") {
    return "rejected";
  }
  return "processed";
}

async function buildSummaryResponse(
  threadId: string,
  timezone: string,
  botId: AssistantBotId
): Promise<AssistantResponsePayload> {
  const history = await listRecentAssistantMessages(threadId, 20, botId);
  if (history.length === 0) {
    return {
      text: "아직 요약할 대화가 없습니다. 먼저 메시지를 보내주세요.",
      provider: "none",
      model: "command"
    };
  }

  try {
    const result = await generateConversationSummary(history, timezone);
    await updateThreadSummary(threadId, result.outputText);
    return {
      text: result.outputText,
      provider: result.provider,
      model: result.model,
      metadata: {
        fallbackFrom: result.fallbackFrom,
        error: result.error,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        estimatedCostUsd: result.estimatedCostUsd
      }
    };
  } catch (caught) {
    const snippets = history
      .slice(-5)
      .map((item, index) => `${index + 1}. ${item.role}: ${truncateText(item.content, 48)}`);
    return {
      text: [
        "요약 생성이 지연되어 최근 대화 핵심만 먼저 전달드려요.",
        ...snippets,
        "다음 행동 1가지를 지정하면 더 정확한 계획으로 이어갈 수 있어요."
      ].join("\n"),
      provider: "none",
      model: "fallback-summary",
      metadata: {
        error: sanitizeErrorMessage(caught)
      }
    };
  }
}

interface AssistantCommandInput {
  botId: AssistantBotId;
  command: string;
  rawText: string;
  userId: number;
  threadId: string;
  firstName?: string;
  timezone: string;
  languageCode?: string;
}

interface AssistantCommandDeps {
  setReminderPaused: (userId: number, paused: boolean) => Promise<unknown>;
  buildDailyBriefing: (botId: AssistantBotId, timezone: string) => Promise<AssistantResponsePayload>;
  buildEveningReview: (botId: AssistantBotId, timezone: string) => Promise<AssistantResponsePayload>;
  buildSummary: (
    threadId: string,
    timezone: string,
    botId: AssistantBotId
  ) => Promise<AssistantResponsePayload>;
  approveAction: (actionId: string, approvedBy: number) => Promise<void>;
  rejectAction: (actionId: string, approvedBy: number) => Promise<void>;
  buildCostMessage: (languageCode?: string | null) => Promise<string>;
}

const defaultCommandDeps: AssistantCommandDeps = {
  setReminderPaused: setAssistantReminderPaused,
  buildDailyBriefing: async (botId, timezone) =>
    buildCompactBriefingResponse({
      botId,
      timezone,
      kind: "morning_plan"
    }),
  buildEveningReview: async (botId, timezone) =>
    buildCompactBriefingResponse({
      botId,
      timezone,
      kind: "evening_review"
    }),
  buildSummary: buildSummaryResponse,
  approveAction: async (actionId, approvedBy) => {
    await updateAssistantActionApprovalStatus({
      actionId,
      status: "approved",
      approvedBy
    });
  },
  rejectAction: async (actionId, approvedBy) => {
    await updateAssistantActionApprovalStatus({
      actionId,
      status: "rejected",
      approvedBy
    });
  },
  buildCostMessage
};

export async function executeAssistantCommand(
  input: AssistantCommandInput,
  deps: AssistantCommandDeps = defaultCommandDeps
): Promise<AssistantResponsePayload> {
  if (input.command === "/start") {
    await deps.setReminderPaused(input.userId, false);
    return {
      text: buildStartMessage(input.botId, input.firstName, input.languageCode),
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/help") {
    return {
      text: buildHelpMessage(input.languageCode),
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/pause") {
    await deps.setReminderPaused(input.userId, true);
    return {
      text: "자동 리마인드를 중지했습니다. 계속 대화는 가능해요. 다시 켜려면 /resume 을 입력하세요.",
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/resume") {
    await deps.setReminderPaused(input.userId, false);
    return {
      text: "자동 리마인드를 다시 시작했습니다. 아침/저녁 리마인드를 보내드릴게요.",
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/summary") {
    return deps.buildSummary(input.threadId, input.timezone, input.botId);
  }

  if (input.command === "/daily") {
    return deps.buildDailyBriefing(input.botId, input.timezone);
  }

  if (input.command === "/review") {
    return deps.buildEveningReview(input.botId, input.timezone);
  }

  if (input.command === "/focus") {
    const arg = extractCommandArgument(input.rawText);
    if (!arg) {
      const current = THREAD_FOCUS_STATE.get(input.threadId) ?? DEFAULT_FOCUS_WEIGHTS;
      return {
        text: [
          "현재 Focus Weights",
          formatFocusWeights(current),
          "",
          "사용법: /focus M1:35 M2:15 M4:15 Mx:15 M3:10 M5:10",
          "입력 값은 합계 100으로 자동 정규화됩니다."
        ].join("\n"),
        provider: "none",
        model: "command"
      };
    }

    const parsed = parseFocusWeights(arg);
    if (!parsed) {
      return {
        text: "형식 오류입니다. 예: /focus M1:50 M2:20 M4:15 Mx:10 M3:3 M5:2",
        provider: "none",
        model: "command"
      };
    }

    THREAD_FOCUS_STATE.set(input.threadId, parsed);
    return {
      text: [
        "Focus Weights 업데이트 완료",
        formatFocusWeights(parsed),
        "이 스레드의 다음 응답부터 해당 가중치를 컨텍스트에 반영합니다."
      ].join("\n"),
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/panel") {
    return {
      text: buildPanelMessage(input.languageCode),
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/check") {
    return {
      text: buildSentryCheckMessage(input.languageCode),
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/cost") {
    return {
      text: await deps.buildCostMessage(input.languageCode),
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/approve") {
    const actionId = extractCommandArgument(input.rawText);
    if (!actionId) {
      return {
        text: "사용법: /approve <action_id>",
        provider: "none",
        model: "command"
      };
    }

    let existing;
    try {
      existing = await getAssistantActionApproval(actionId);
    } catch (caught) {
      if (isFeatureTableMissing(caught)) {
        return {
          text: "승인 게이트 테이블이 아직 준비되지 않았습니다. 마이그레이션 후 다시 시도해 주세요.",
          provider: "none",
          model: "command"
        };
      }
      throw caught;
    }
    if (!existing) {
      return {
        text: `해당 action_id를 찾지 못했습니다: ${actionId}`,
        provider: "none",
        model: "command"
      };
    }

    await deps.approveAction(actionId, input.userId);
    return {
      text: `승인 완료: ${actionId}\n이제 실행 단계로 진행할 수 있습니다.`,
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/reject") {
    const actionId = extractCommandArgument(input.rawText);
    if (!actionId) {
      return {
        text: "사용법: /reject <action_id>",
        provider: "none",
        model: "command"
      };
    }

    let existing;
    try {
      existing = await getAssistantActionApproval(actionId);
    } catch (caught) {
      if (isFeatureTableMissing(caught)) {
        return {
          text: "승인 게이트 테이블이 아직 준비되지 않았습니다. 마이그레이션 후 다시 시도해 주세요.",
          provider: "none",
          model: "command"
        };
      }
      throw caught;
    }
    if (!existing) {
      return {
        text: `해당 action_id를 찾지 못했습니다: ${actionId}`,
        provider: "none",
        model: "command"
      };
    }

    await deps.rejectAction(actionId, input.userId);
    return {
      text: `거절 완료: ${actionId}\n승인 대기열에서 제외했습니다.`,
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/ops") {
    return {
      text: buildOpsStatusMessage(input.languageCode),
      provider: "none",
      model: "command"
    };
  }

  if (input.command === "/mayhem") {
    return {
      text: buildMayhemKickoffMessage(input.timezone),
      provider: "none",
      model: "command"
    };
  }

  return {
    text: `알 수 없는 명령어입니다.\n\n${buildHelpMessage(input.languageCode)}`,
    provider: "none",
    model: "command"
  };
}

async function buildChatResponse(input: AssistantGenerationInput): Promise<AssistantResponsePayload> {
  const result = await generateAssistantReply(input);
  return {
    text: result.outputText,
    provider: result.provider,
    model: result.model,
    metadata: {
      fallbackFrom: result.fallbackFrom,
      providerError: result.error,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
      estimatedCostUsd: result.estimatedCostUsd,
      ...(result.metadata ?? {})
    }
  };
}

function isPrivateChat(chatType: string | undefined) {
  return chatType === "private";
}

function isMentioned(text: string, username: string | undefined) {
  if (!username) {
    return false;
  }
  return text.toLowerCase().includes(`@${username.toLowerCase()}`);
}

function isInternalBotMessage(
  from:
    | {
        is_bot?: boolean;
        username?: string;
      }
    | undefined,
  config: AssistantConfig
) {
  if (!from || !from.is_bot || !from.username) {
    return false;
  }
  const normalized = from.username.toLowerCase();
  return Object.values(config.telegramBots).some(
    (runtime) => runtime.username?.toLowerCase() === normalized
  );
}

function isInternalBotAllowedInChat(chatId: number, config: AssistantConfig) {
  return config.telegramAllowedChatIds.has(chatId);
}

function requestsStructuredOutput(text: string) {
  const lower = text.toLowerCase();
  return (
    lower.includes("json") ||
    lower.includes("yaml") ||
    lower.includes("xml") ||
    lower.includes("csv") ||
    lower.includes("코드블록") ||
    lower.includes("```")
  );
}

function extractCommandArgument(rawText: string) {
  const tokens = rawText.trim().split(/\s+/);
  return tokens.length > 1 ? tokens.slice(1).join(" ").trim() : "";
}

function cloneFocus(weights: FocusWeights): FocusWeights {
  return {
    M1: weights.M1,
    M2: weights.M2,
    M3: weights.M3,
    M4: weights.M4,
    M5: weights.M5,
    Mx: weights.Mx
  };
}

function formatFocusWeights(weights: FocusWeights) {
  return MISSION_CODES.map((code) => `${code}:${weights[code]}`).join(" ");
}

function normalizeFocusWeights(raw: Partial<Record<MissionCode, number>>): FocusWeights {
  const safe = MISSION_CODES.map((code) => {
    const value = Number(raw[code] ?? 0);
    return Number.isFinite(value) && value > 0 ? value : 0;
  });
  const total = safe.reduce((acc, value) => acc + value, 0);
  if (total <= 0) {
    return cloneFocus(DEFAULT_FOCUS_WEIGHTS);
  }

  const scaled = safe.map((value) => (value / total) * 100);
  const rounded = scaled.map((value) => Math.floor(value));
  let remain = 100 - rounded.reduce((acc, value) => acc + value, 0);
  const remainderOrder = scaled
    .map((value, index) => ({
      index,
      remain: value - Math.floor(value)
    }))
    .sort((a, b) => b.remain - a.remain);

  let cursor = 0;
  while (remain > 0 && cursor < remainderOrder.length) {
    rounded[remainderOrder[cursor].index] += 1;
    remain -= 1;
    cursor += 1;
  }

  return {
    M1: rounded[0],
    M2: rounded[1],
    M3: rounded[2],
    M4: rounded[3],
    M5: rounded[4],
    Mx: rounded[5]
  };
}

function parseFocusWeights(text: string): FocusWeights | null {
  const normalized = text.replaceAll(",", " ");
  const matches = Array.from(normalized.matchAll(/\b(M[1-5]|Mx)\s*:\s*(\d+(?:\.\d+)?)\b/gi));
  if (matches.length === 0) {
    return null;
  }

  const parsed: Partial<Record<MissionCode, number>> = {};
  for (const match of matches) {
    const mission = match[1];
    const value = Number(match[2]);
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }
    if (mission === "Mx" || mission === "mx") {
      parsed.Mx = value;
    } else if (mission === "M1" || mission === "m1") {
      parsed.M1 = value;
    } else if (mission === "M2" || mission === "m2") {
      parsed.M2 = value;
    } else if (mission === "M3" || mission === "m3") {
      parsed.M3 = value;
    } else if (mission === "M4" || mission === "m4") {
      parsed.M4 = value;
    } else if (mission === "M5" || mission === "m5") {
      parsed.M5 = value;
    }
  }

  const hasAny = MISSION_CODES.some((code) => Number(parsed[code] ?? 0) > 0);
  if (!hasAny) {
    return null;
  }
  return normalizeFocusWeights(parsed);
}

function maybeParseFocusFromText(text: string): FocusWeights | null {
  const lower = text.trim().toLowerCase();
  if (!lower.startsWith("/focus")) {
    return null;
  }
  const args = extractCommandArgument(text);
  return parseFocusWeights(args);
}

function resolveThreadFocusWeights(threadId: string, history: Array<{ content: string }>): FocusWeights {
  const cached = THREAD_FOCUS_STATE.get(threadId);
  if (cached) {
    return cloneFocus(cached);
  }

  for (let index = history.length - 1; index >= 0; index -= 1) {
    const parsed = maybeParseFocusFromText(history[index].content);
    if (parsed) {
      THREAD_FOCUS_STATE.set(threadId, parsed);
      return cloneFocus(parsed);
    }
  }

  return cloneFocus(DEFAULT_FOCUS_WEIGHTS);
}

function buildFocusContext(weights: FocusWeights) {
  return `[시스템] 현재 Focus Weights: ${formatFocusWeights(weights)}`;
}

function resolveForcedBotByTag(text: string): AssistantCanonicalBotId | null {
  const lower = text.toLowerCase();
  const hasTag = (tag: string) => lower.includes(tag);

  if (hasTag("#risk") || hasTag("#check") || hasTag("#qa")) {
    return "michael_corleone";
  }
  if (hasTag("#interrupt")) {
    return "jensen_huang";
  }
  if (hasTag("#emperor") || text.includes("#제왕")) {
    return "zhuge_liang";
  }
  if (
    hasTag("#vision") ||
    hasTag("#antivision") ||
    hasTag("#anti-vision") ||
    hasTag("#game") ||
    hasTag("#score") ||
    hasTag("#excavation")
  ) {
    return "tyler_durden";
  }
  return null;
}

function maybeCreateRoundKey(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 140);
}

function isFeatureTableMissing(error: unknown) {
  const message = sanitizeErrorMessage(error).toLowerCase();
  return (
    message.includes("pgrst205") ||
    message.includes("could not find the table") ||
    message.includes("relation") ||
    message.includes("does not exist")
  );
}

function extractFirstValidJsonObject(text: string): string | null {
  const codeBlocks = Array.from(text.matchAll(/```(?:json)?\s*([\s\S]*?)\s*```/gi)).map(
    (match) => match[1].trim()
  );
  for (const block of codeBlocks) {
    try {
      JSON.parse(block);
      return block;
    } catch {
      continue;
    }
  }

  const start = text.indexOf("{");
  if (start === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const ch = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }
    if (ch === "{") {
      depth += 1;
    } else if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        const candidate = text.slice(start, index + 1).trim();
        try {
          JSON.parse(candidate);
          return candidate;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function formatLensJsonToPlainText(text: string) {
  const jsonBlock = extractFirstValidJsonObject(text);
  if (!jsonBlock) {
    return text;
  }

  try {
    const payload = JSON.parse(jsonBlock) as Record<string, unknown>;
    const lines: string[] = [];

    if (typeof payload.conclusion === "string" && payload.conclusion.trim()) {
      lines.push(`핵심 결론: ${payload.conclusion.trim()}`);
    }

    const findings = Array.isArray(payload.findings) ? payload.findings : [];
    if (findings.length > 0) {
      lines.push("근거:");
      for (const finding of findings.slice(0, 3)) {
        if (!finding || typeof finding !== "object") {
          continue;
        }
        const claim =
          "claim" in finding && typeof finding.claim === "string" ? finding.claim.trim() : "";
        const label =
          "label" in finding && typeof finding.label === "string" ? finding.label.trim() : "";
        if (!claim) {
          continue;
        }
        lines.push(label ? `- ${claim} [${label}]` : `- ${claim}`);
      }
    }

    const risks = Array.isArray(payload.risks) ? payload.risks : [];
    if (risks.length > 0) {
      lines.push("주의할 점:");
      for (const risk of risks.slice(0, 2)) {
        if (typeof risk === "string" && risk.trim()) {
          lines.push(`- ${risk.trim()}`);
        }
      }
    }

    const actions = Array.isArray(payload.actions_48h) ? payload.actions_48h : [];
    if (actions.length > 0) {
      lines.push("다음 48시간 액션:");
      for (const action of actions.slice(0, 3)) {
        if (!action || typeof action !== "object") {
          continue;
        }
        const actionText =
          "action" in action && typeof action.action === "string" ? action.action.trim() : "";
        const dod = "dod" in action && typeof action.dod === "string" ? action.dod.trim() : "";
        if (!actionText) {
          continue;
        }
        lines.push(dod ? `- ${actionText} (DoD: ${dod})` : `- ${actionText}`);
      }
    }

    return lines.length > 0 ? lines.join("\n") : text;
  } catch {
    return text;
  }
}

function shouldTriggerPanel(text: string) {
  const lower = text.toLowerCase();
  const lenses = ["분석", "근거", "리서치", "lens", "facts"];
  const execution = ["실행", "마감", "task", "bolt", "next", "done"];
  const content = ["콘텐츠", "스레드", "발행", "ink", "바이럴"];
  const risk = ["리스크", "검증", "qa", "check", "sentry"];
  const categories = [lenses, execution, content, risk];
  const score = categories.reduce((acc, keywords) => {
    return acc + (keywords.some((keyword) => lower.includes(keyword)) ? 1 : 0);
  }, 0);
  return score >= 2;
}

function detectExternalActionType(text: string): string | null {
  const lower = text.toLowerCase();
  if (lower.includes("신청") || lower.includes("apply") || lower.includes("등록")) {
    return "event_apply";
  }
  if (lower.includes("결제") || lower.includes("pay") || lower.includes("구매")) {
    return "payment";
  }
  if (lower.includes("발행") || lower.includes("publish") || lower.includes("업로드")) {
    return "publish";
  }
  return null;
}

function estimateTokenCount(text: string) {
  const compact = text.trim();
  if (!compact) {
    return 0;
  }
  const words = compact.split(/\s+/).filter(Boolean).length;
  const byWords = words * 1.3;
  const byChars = compact.length / 2;
  return Math.ceil(Math.max(byWords, byChars));
}

function shouldQueueLocalHeavy(
  botId: AssistantBotId,
  text: string,
  config: AssistantConfig,
  hasStructuredRequest: boolean,
  chatType?: string
) {
  const normalizedBotId = normalizeAssistantBotId(botId);

  if (!config.localWorkerSecret) {
    return false;
  }

  // Group chats should stay responsive; queueing is limited to private chats.
  if (!isPrivateChat(chatType)) {
    return false;
  }

  if (hasStructuredRequest) {
    return false;
  }

  if (!config.localHeavyEnableBots.has(normalizedBotId)) {
    return false;
  }

  if (text.length >= config.localHeavyCharsThreshold) {
    return true;
  }

  if (estimateTokenCount(text) >= config.localHeavyTokenThreshold) {
    return true;
  }

  const lower = text.toLowerCase();
  const heavyKeywords = [
    "blog",
    "article",
    "deep research",
    "deep dive",
    "블로그",
    "아티클",
    "딥다이브",
    "장문",
    "긴 글",
    "리서치",
    "콘텐츠",
    "콘텐츠 작성",
    "시장 분석",
    "분석 리포트",
    "스레드",
    "스레드 작성",
    "팩트체크"
  ];
  return heavyKeywords.some((keyword) => lower.includes(keyword));
}

function isPanelCooldownActive(chatId: number, now: number) {
  const expiresAt = groupPanelCooldownByChat.get(chatId) ?? 0;
  return expiresAt > now;
}

function armPanelCooldown(chatId: number, now: number) {
  groupPanelCooldownByChat.set(chatId, now + GROUP_PANEL_COOLDOWN_MS);
}

export async function processTelegramUpdate(
  update: TelegramUpdate,
  source: AssistantUpdateSource = "webhook",
  botId: AssistantBotId = "tyler_durden"
) {
  const requestedBotId = normalizeAssistantBotId(botId);
  const config = getAssistantConfig();
  const runtimeBot = config.telegramBots[requestedBotId];
  const message = update.message ?? update.edited_message;
  const text = message?.text?.trim();
  const userId = message?.from?.id;
  const chatId = message?.chat?.id;
  const forcedBotId = text && !text.startsWith("/") ? resolveForcedBotByTag(text) : null;
  const effectiveBotId = forcedBotId ?? requestedBotId;
  const routedByTag = Boolean(forcedBotId && forcedBotId !== requestedBotId);

  const reserved = await reserveAssistantUpdate({
    botId: requestedBotId,
    updateId: update.update_id,
    source,
    userId,
    chatId
  });

  if (!reserved.reserved) {
    return {
      status: "duplicate",
      updateId: update.update_id
    };
  }

  if (!message || !text || !userId || !chatId) {
    await markAssistantUpdateStatus(update.update_id, "ignored", undefined, requestedBotId);
    return {
      status: "ignored",
      reason: "unsupported_update"
    };
  }

  const internalBotSource = isInternalBotMessage(message.from, config);
  if (internalBotSource && requestedBotId === "tyler_durden") {
    await markAssistantUpdateStatus(
      update.update_id,
      "ignored",
      "internal_bot_source",
      requestedBotId
    );
    return {
      status: "ignored",
      reason: "internal_bot_source"
    };
  }

  if (!isPrivateChat(message.chat.type) && requestedBotId !== "tyler_durden") {
    const isCommand = text.startsWith("/");
    const mentioned = isMentioned(text, runtimeBot.username);
    if (!isCommand && !mentioned) {
      await markAssistantUpdateStatus(
        update.update_id,
        "ignored",
        "group_not_mentioned",
        requestedBotId
      );
      return {
        status: "ignored",
        reason: "group_not_mentioned"
      };
    }
  }

  const allowlisted = isAllowlisted(userId, chatId, config);
  const internalBotAllowed = internalBotSource && isInternalBotAllowedInChat(chatId, config);
  if (!allowlisted && !internalBotAllowed) {
    await markAssistantUpdateStatus(
      update.update_id,
      "blocked",
      "allowlist_blocked",
      requestedBotId
    );
    return {
      status: "blocked"
    };
  }

  if (!internalBotSource && isRateLimited(userId, config.rateLimitPerMinute)) {
    await sendTelegramMessage({
      botId: requestedBotId,
      chatId,
      text: "요청이 너무 빠르게 들어오고 있어요. 잠시 후 다시 시도해 주세요.",
      replyToMessageId: message.message_id
    });
    await markAssistantUpdateStatus(update.update_id, "rate_limited", undefined, requestedBotId);
    return {
      status: "rate_limited"
    };
  }

  const threadId = buildThreadId(chatId, requestedBotId);

  try {
    const user = await upsertAssistantUser({
      userId,
      chatId,
      username: message.from?.username,
      firstName: message.from?.first_name,
      languageCode: message.from?.language_code,
      timezone: config.assistantTimezone
    });

    await touchAssistantThread({
      botId: requestedBotId,
      threadId,
      userId: user.userId,
      chatId: user.chatId,
      locale: user.languageCode
    });

    const history = await listRecentAssistantMessages(
      threadId,
      config.historyWindowLocal,
      requestedBotId
    );
    const historyForCloud = history.slice(-config.historyWindowCloud);
    const focusWeights = resolveThreadFocusWeights(threadId, history);
    const focusContext =
      effectiveBotId === "tyler_durden" ? buildFocusContext(focusWeights) : undefined;
    await appendAssistantMessage({
      botId: requestedBotId,
      threadId,
      role: "user",
      content: text,
      provider: "none",
      model: "telegram",
      telegramUpdateId: update.update_id,
      metadata: {
        source,
        requestedBotId,
        effectiveBotId,
        routedByTag
      }
    });

    let responsePayload: AssistantResponsePayload = {
      text: FALLBACK_REPLY,
      provider: "none",
      model: "init-fallback"
    };
    let status = "processed";

    if (text.startsWith("/")) {
      const command = normalizeCommand(text);
      responsePayload = await executeAssistantCommand({
        botId: requestedBotId,
        command,
        rawText: text,
        userId,
        threadId,
        firstName: user.firstName,
        timezone: user.timezone,
        languageCode: user.languageCode
      });
      status = commandToStatus(command);
    } else {
      const structuredRequested = requestsStructuredOutput(text);
      const queueLocal = shouldQueueLocalHeavy(
        effectiveBotId,
        text,
        config,
        structuredRequested,
        message.chat.type
      );
      let queuedLocal = false;

      if (queueLocal) {
        try {
          const job = await enqueueAssistantLocalJob({
            botId: effectiveBotId,
            chatId,
            userId,
            threadId,
            mode: "local_heavy",
            payload: {
              taskType: "chat_reply",
              timezone: user.timezone,
              userText: text,
              history,
              focusContext,
              requestedBotId,
              effectiveBotId,
              originUpdateId: update.update_id,
              replyToMessageId: message.message_id
            }
          });

          responsePayload = {
            text: `${LOCAL_QUEUE_NOTICE}\njob_id: ${job.jobId}`,
            provider: "none",
            model: "local-queued",
            metadata: {
              localJobId: job.jobId,
              requestedBotId,
              effectiveBotId,
              routedByTag
            }
          };
          status = "queued_local";
          queuedLocal = true;
        } catch (caught) {
          if (!isFeatureTableMissing(caught)) {
            throw caught;
          }
        }
      }

      if (!queuedLocal) {
        const actionType = detectExternalActionType(text);
        let pendingActionId: string | undefined;
        if (actionType) {
          try {
            const action = await createAssistantActionApproval({
              requestedByBot: effectiveBotId,
              actionType,
              payload: {
                chatId,
                userId,
                text,
                source,
                originUpdateId: update.update_id
              },
              status: "pending"
            });
            pendingActionId = action.actionId;
          } catch (caught) {
            if (!isFeatureTableMissing(caught)) {
              throw caught;
            }
          }
        }

        const chatResponse = await buildChatResponse({
          botId: effectiveBotId,
          history: historyForCloud,
          userText: pendingActionId
            ? `${focusContext ? `${focusContext}\n\n` : ""}${text}\n\n[시스템] 외부행동은 승인 전 실행 금지. action_id=${pendingActionId}`
            : `${focusContext ? `${focusContext}\n\n` : ""}${text}`,
          timezone: user.timezone
        });

        responsePayload = chatResponse;
        if (effectiveBotId === "zhuge_liang" && !structuredRequested) {
          responsePayload = {
            ...responsePayload,
            text: formatLensJsonToPlainText(responsePayload.text)
          };
        }

        if (pendingActionId) {
          responsePayload = {
            ...responsePayload,
            text: `${responsePayload.text}\n\n승인 필요: /approve ${pendingActionId}\n거절: /reject ${pendingActionId}`,
            metadata: {
              ...responsePayload.metadata,
              pendingActionId,
              requestedBotId,
              effectiveBotId,
              routedByTag
            }
          };
        }

        if (!isPrivateChat(message.chat.type) && requestedBotId === "tyler_durden") {
          const now = Date.now();
          const roundKey = maybeCreateRoundKey(text);
          const previousRoundKey = groupPanelRoundDedupByChat.get(chatId);
          const panelTriggered =
            shouldTriggerPanel(text) &&
            !isPanelCooldownActive(chatId, now) &&
            previousRoundKey !== roundKey;

          if (panelTriggered) {
            armPanelCooldown(chatId, now);
            groupPanelRoundDedupByChat.set(chatId, roundKey);
            responsePayload = {
              ...chatResponse,
              text: `${buildPanelMessage(user.languageCode)}\n\n${chatResponse.text}`,
              metadata: {
                ...chatResponse.metadata,
                panelTriggered: true,
                originUpdateId: update.update_id,
                panelRoundKey: roundKey,
                requestedBotId,
                effectiveBotId,
                routedByTag
              }
            };
          }
        }
      }
    }

    await sendTelegramMessage({
      botId: requestedBotId,
      chatId,
      text: responsePayload.text,
      replyToMessageId: message.message_id
    });

    await appendAssistantMessage({
      botId: requestedBotId,
      threadId,
      role: "assistant",
      content: responsePayload.text,
      provider: responsePayload.provider,
      model: responsePayload.model,
      telegramUpdateId: update.update_id,
      metadata: {
        ...(responsePayload.metadata ?? {}),
        requestedBotId,
        effectiveBotId,
        routedByTag
      }
    });

    if (responsePayload.provider !== "none") {
      await appendAssistantCostLog({
        botId: effectiveBotId,
        provider: responsePayload.provider,
        model: responsePayload.model,
        tokensIn: Number((responsePayload.metadata?.tokensIn as number | undefined) ?? 0),
        tokensOut: Number((responsePayload.metadata?.tokensOut as number | undefined) ?? 0),
        estimatedCostUsd: Number((responsePayload.metadata?.estimatedCostUsd as number | undefined) ?? 0),
        path: "chat"
      }).catch(() => undefined);
    }

    await markAssistantUpdateStatus(update.update_id, status, undefined, requestedBotId);
    return {
      status,
      provider: responsePayload.provider
    };
  } catch (caught) {
    const error = sanitizeErrorMessage(caught);

    await appendAssistantMessage({
      botId: requestedBotId,
      threadId,
      role: "assistant",
      content: FALLBACK_REPLY,
      provider: "none",
      model: "error-fallback",
      telegramUpdateId: update.update_id,
      metadata: {
        error,
        requestedBotId,
        effectiveBotId,
        routedByTag
      }
    }).catch(() => undefined);

    await sendTelegramMessage({
      botId: requestedBotId,
      chatId,
      text: FALLBACK_REPLY,
      replyToMessageId: message.message_id
    }).catch(() => undefined);

    await markAssistantUpdateStatus(update.update_id, "failed", error, requestedBotId);
    return {
      status: "failed",
      error
    };
  }
}

function resolveReminderKind(inputKind: ReminderJobKind | undefined, timezone: string, now: Date) {
  if (inputKind) {
    return inputKind;
  }
  const local = getLocalDateParts(timezone, now);
  return resolveReminderKindByHour(local.hour);
}

export async function runReminderBatch(options?: {
  botId?: AssistantBotId;
  kind?: ReminderJobKind;
  now?: Date;
  source?: string;
}) {
  const config = getAssistantConfig();
  const botId = normalizeAssistantBotId(options?.botId);
  const now = options?.now ?? new Date();
  const local = getLocalDateParts(config.assistantTimezone, now);
  const kind = resolveReminderKind(options?.kind, config.assistantTimezone, now);
  const scheduleDate = local.dateKey;
  const targets = await listReminderTargets();
  const reminderPrompt = buildCompactBriefingPrompt(
    kind,
    config.assistantTimezone,
    config.newsDefaultCount,
    now
  );

  let sharedReminderText: string | null = null;
  try {
    const generated = await generateAssistantReply({
      botId,
      history: [],
      userText: reminderPrompt,
      timezone: config.assistantTimezone,
      maxOutputTokens: 900,
      temperature: 0.2
    });
    sharedReminderText = generated.outputText;

    if (generated.provider !== "none") {
      await appendAssistantCostLog({
        botId,
        provider: generated.provider,
        model: generated.model,
        tokensIn: generated.tokensIn ?? 0,
        tokensOut: generated.tokensOut ?? 0,
        estimatedCostUsd: generated.estimatedCostUsd ?? 0,
        path: `reminder:${kind}`
      }).catch(() => undefined);
    }
  } catch {
    sharedReminderText = null;
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const user of targets) {
    const jobResult = await createReminderJobIfNotExists({
      botId,
      userId: user.userId,
      chatId: user.chatId,
      kind,
      scheduleDate,
      timezone: user.timezone ?? config.assistantTimezone,
      scheduledFor: now.toISOString()
    });

    const job = jobResult.job;
    const isAlreadyFinalized =
      !jobResult.created && (job.status === "sent" || job.status === "skipped");

    if (isAlreadyFinalized) {
      skipped += 1;
      continue;
    }

    if (!isAllowlisted(user.userId, user.chatId, config)) {
      await markReminderJobStatus(job.jobId, "skipped", {
        lastError: "allowlist_blocked",
        incrementAttempt: false
      });
      skipped += 1;
      continue;
    }

    if (user.remindersPaused) {
      await markReminderJobStatus(job.jobId, "skipped", {
        lastError: "user_paused",
        incrementAttempt: false
      });
      skipped += 1;
      continue;
    }

    try {
      await sendTelegramMessage({
        botId,
        chatId: user.chatId,
        text: sharedReminderText ?? buildReminderMessage(kind, user.firstName),
        disableNotification: kind === "morning_plan"
      });

      await markReminderJobStatus(job.jobId, "sent", {
        sentAt: new Date().toISOString(),
        incrementAttempt: true
      });
      sent += 1;
    } catch (caught) {
      await markReminderJobStatus(job.jobId, "failed", {
        lastError: sanitizeErrorMessage(caught),
        incrementAttempt: true
      });
      failed += 1;
    }
  }

  return {
    botId,
    kind,
    scheduleDate,
    timezone: config.assistantTimezone,
    source: options?.source ?? "api",
    totalTargets: targets.length,
    sent,
    skipped,
    failed
  };
}

export function resolveReminderKindFromRequest(input: {
  queryKind?: string | null;
  bodyKind?: string | null;
}) {
  return parseReminderKind(input.bodyKind) ?? parseReminderKind(input.queryKind);
}

export function __private_requestsStructuredOutput(text: string) {
  return requestsStructuredOutput(text);
}

export function __private_formatLensJsonToPlainText(text: string) {
  return formatLensJsonToPlainText(text);
}

export function __private_shouldQueueLocalHeavy(
  botId: AssistantBotId,
  text: string,
  config: AssistantConfig,
  hasStructuredRequest: boolean,
  chatType?: string
) {
  return shouldQueueLocalHeavy(botId, text, config, hasStructuredRequest, chatType);
}

export function __private_parseFocusWeights(text: string) {
  return parseFocusWeights(text);
}

export function __private_resolveForcedBotByTag(text: string) {
  return resolveForcedBotByTag(text);
}

export function __private_buildCompactBriefingPrompt(
  kind: ReminderJobKind,
  timezone: string,
  newsCount: number,
  now = new Date()
) {
  return buildCompactBriefingPrompt(kind, timezone, newsCount, now);
}
