import type { AssistantBotId } from "@/lib/assistant-types";

export const ASSISTANT_BOT_IDS: AssistantBotId[] = [
  "tyler_durden",
  "zhuge_liang",
  "jensen_huang",
  "hemingway_ernest",
  "alfred_sentry"
];

export interface AssistantBotProfile {
  id: AssistantBotId;
  displayName: string;
  fallbackDisplayName?: string;
  roleLabel: string;
}

const BOT_PROFILES: Record<AssistantBotId, AssistantBotProfile> = {
  tyler_durden: {
    id: "tyler_durden",
    displayName: "Tyler.Durden",
    roleLabel: "오케스트레이터"
  },
  zhuge_liang: {
    id: "zhuge_liang",
    displayName: "제갈량",
    fallbackDisplayName: "Zhuge Liang",
    roleLabel: "LENS 분석관"
  },
  jensen_huang: {
    id: "jensen_huang",
    displayName: "Jensen Huang",
    roleLabel: "BOLT 실행/마감"
  },
  hemingway_ernest: {
    id: "hemingway_ernest",
    displayName: "Hemingway, Ernest",
    roleLabel: "INK 콘텐츠/바이럴"
  },
  alfred_sentry: {
    id: "alfred_sentry",
    displayName: "Alfred.Sentry",
    roleLabel: "SENTRY QA/보안/비용"
  }
};

export function isAssistantBotId(value: string | null | undefined): value is AssistantBotId {
  return Boolean(value && ASSISTANT_BOT_IDS.includes(value as AssistantBotId));
}

export function resolveAssistantBotId(
  value: string | null | undefined,
  fallback: AssistantBotId = "tyler_durden"
): AssistantBotId {
  return isAssistantBotId(value) ? value : fallback;
}

export function getAssistantBotProfile(botId: AssistantBotId): AssistantBotProfile {
  return BOT_PROFILES[botId];
}

export function getAssistantBotDisplayName(
  botId: AssistantBotId,
  languageCode?: string | null
): string {
  const profile = getAssistantBotProfile(botId);
  if (
    profile.id === "zhuge_liang" &&
    profile.fallbackDisplayName &&
    (!languageCode || !languageCode.toLowerCase().startsWith("ko"))
  ) {
    return profile.fallbackDisplayName;
  }
  return profile.displayName;
}

export function getAssistantTeamDisplayLines(languageCode?: string | null): string[] {
  return ASSISTANT_BOT_IDS.map((botId) => {
    const profile = getAssistantBotProfile(botId);
    const displayName = getAssistantBotDisplayName(botId, languageCode);
    return `- ${displayName}: ${profile.roleLabel}`;
  });
}
