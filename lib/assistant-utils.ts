import type { ReminderJobKind } from "@/lib/assistant-types";
import type { AssistantBotId } from "@/lib/assistant-types";

const TOKEN_PATTERNS = [
  /sk-[a-zA-Z0-9_-]+/g,
  /sb_secret_[a-zA-Z0-9._-]+/g,
  /\b\d{8,11}:[A-Za-z0-9_-]{25,}\b/g,
  /xoxb-[a-zA-Z0-9-]+/g,
  /Bearer\s+[a-zA-Z0-9._-]+/gi
];

export function buildThreadId(chatId: number, botId: AssistantBotId = "tyler_durden"): string {
  return `telegram:${botId}:${chatId}`;
}

export function sanitizeErrorMessage(input: unknown): string {
  const message = input instanceof Error ? input.message : String(input);
  return TOKEN_PATTERNS.reduce((acc, pattern) => acc.replace(pattern, "[REDACTED]"), message);
}

export function truncateText(text: string, maxLength = 160): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
}

export function getLocalDateParts(timeZone: string, reference = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });

  const parts = formatter
    .formatToParts(reference)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") {
        acc[part.type] = part.value;
      }
      return acc;
    }, {});

  return {
    year: Number(parts.year ?? "0"),
    month: Number(parts.month ?? "0"),
    day: Number(parts.day ?? "0"),
    hour: Number(parts.hour ?? "0"),
    minute: Number(parts.minute ?? "0"),
    second: Number(parts.second ?? "0"),
    dateKey: `${parts.year}-${parts.month}-${parts.day}`
  };
}

export function resolveReminderKindByHour(hour: number): ReminderJobKind {
  return hour >= 15 ? "evening_review" : "morning_plan";
}

export function buildReminderMessage(kind: ReminderJobKind, firstName?: string): string {
  const prefix = firstName ? `${firstName}님,` : "안녕하세요,";

  if (kind === "morning_plan") {
    return `${prefix} 좋은 아침입니다. 오늘 가장 중요한 1가지와 첫 실행 시간을 정해보세요. 필요하면 지금 바로 계획을 같이 정리해드릴게요.`;
  }

  return `${prefix} 오늘 하루를 짧게 정리해볼까요? 잘한 1가지, 아쉬운 1가지, 내일 첫 행동 1가지를 보내주시면 회고를 도와드릴게요.`;
}

export function normalizeCommand(rawText: string): string {
  const [firstToken] = rawText.trim().split(/\s+/);
  const commandWithoutBot = firstToken.toLowerCase().replace(/@.+$/, "");
  return commandWithoutBot;
}

export function parseReminderKind(value: string | null | undefined): ReminderJobKind | undefined {
  if (value === "morning_plan" || value === "evening_review") {
    return value;
  }
  return undefined;
}
