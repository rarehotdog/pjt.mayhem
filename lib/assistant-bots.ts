import type { AssistantBotId, AssistantCanonicalBotId } from "@/lib/assistant-types";

export const ASSISTANT_BOT_IDS: AssistantCanonicalBotId[] = [
  "tyler_durden",
  "zhuge_liang",
  "jensen_huang",
  "hemingway_ernest",
  "michael_corleone"
];

export interface AssistantBotProfile {
  id: AssistantCanonicalBotId;
  displayName: string;
  fallbackDisplayName?: string;
  roleLabel: string;
}

const BOT_ALIAS_TO_CANONICAL: Record<AssistantBotId, AssistantCanonicalBotId> = {
  tyler_durden: "tyler_durden",
  zhuge_liang: "zhuge_liang",
  jensen_huang: "jensen_huang",
  hemingway_ernest: "hemingway_ernest",
  michael_corleone: "michael_corleone",
  alfred_sentry: "michael_corleone"
};

const BOT_PROFILES: Record<AssistantCanonicalBotId, AssistantBotProfile> = {
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
  michael_corleone: {
    id: "michael_corleone",
    displayName: "Michael Corleone",
    roleLabel: "SENTRY QA/보안/비용"
  }
};

export function isAssistantBotId(value: string | null | undefined): value is AssistantBotId {
  return Boolean(value && Object.prototype.hasOwnProperty.call(BOT_ALIAS_TO_CANONICAL, value));
}

export function normalizeAssistantBotId(
  value: string | null | undefined,
  fallback: AssistantCanonicalBotId = "tyler_durden"
): AssistantCanonicalBotId {
  if (!isAssistantBotId(value)) {
    return fallback;
  }
  return BOT_ALIAS_TO_CANONICAL[value];
}

export function resolveAssistantBotId(
  value: string | null | undefined,
  fallback: AssistantCanonicalBotId = "tyler_durden"
): AssistantCanonicalBotId {
  return normalizeAssistantBotId(value, fallback);
}

export function getAssistantBotProfile(botId: AssistantBotId): AssistantBotProfile {
  return BOT_PROFILES[normalizeAssistantBotId(botId)];
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
