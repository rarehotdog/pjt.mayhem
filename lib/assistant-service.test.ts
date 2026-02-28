import { describe, expect, it, vi } from "vitest";

import {
  __private_formatLensJsonToPlainText,
  __private_requestsStructuredOutput,
  __private_shouldQueueLocalHeavy,
  executeAssistantCommand
} from "@/lib/assistant-service";
import type { AssistantConfig } from "@/lib/assistant-config";

function buildDeps() {
  return {
    setReminderPaused: vi.fn(async () => undefined),
    buildSummary: vi.fn(async () => ({
      text: "요약 결과",
      provider: "none" as const,
      model: "test"
    })),
    approveAction: vi.fn(async () => undefined),
    rejectAction: vi.fn(async () => undefined),
    buildCostMessage: vi.fn(async () => "비용 요약")
  };
}

function buildConfig(overrides: Partial<AssistantConfig> = {}): AssistantConfig {
  return {
    telegramBots: {
      tyler_durden: {
        token: "token-cos",
        webhookSecret: "secret-cos",
        username: "tyler"
      },
      zhuge_liang: {
        token: "token-lens",
        webhookSecret: "secret-lens",
        username: "lens"
      },
      jensen_huang: {
        token: "token-bolt",
        webhookSecret: "secret-bolt",
        username: "bolt"
      },
      hemingway_ernest: {
        token: "token-ink",
        webhookSecret: "secret-ink",
        username: "ink"
      },
      alfred_sentry: {
        token: "token-sentry",
        webhookSecret: "secret-sentry",
        username: "sentry"
      }
    },
    telegramAllowedUserIds: new Set<number>([111]),
    telegramAllowedChatIds: new Set<number>([222]),
    telegramMayhemChatId: undefined,
    openAiApiKey: "openai",
    openAiModel: "gpt-5.2",
    openAiModelCandidates: ["gpt-5.2"],
    anthropicApiKey: "anthropic",
    anthropicModel: "claude-sonnet-4-5",
    assistantTimezone: "Asia/Seoul",
    rateLimitPerMinute: 20,
    localWorkerSecret: "worker-secret",
    localHeavyCharsThreshold: 520,
    localHeavyTokenThreshold: 2200,
    localHeavyEnableBots: new Set([
      "tyler_durden",
      "zhuge_liang",
      "jensen_huang",
      "hemingway_ernest"
    ]),
    historyWindowCloud: 8,
    historyWindowLocal: 20,
    dailyCostCapUsd: 15,
    dailyTokenCap: 250000,
    ...overrides
  };
}

describe("assistant commands", () => {
  it("/pause stores paused state", async () => {
    const deps = buildDeps();

    const result = await executeAssistantCommand(
      {
        botId: "tyler_durden",
        command: "/pause",
        rawText: "/pause",
        userId: 123,
        threadId: "telegram:1",
        timezone: "Asia/Seoul"
      },
      deps
    );

    expect(deps.setReminderPaused).toHaveBeenCalledWith(123, true);
    expect(result.text).toContain("중지");
  });

  it("/resume clears paused state", async () => {
    const deps = buildDeps();

    const result = await executeAssistantCommand(
      {
        botId: "tyler_durden",
        command: "/resume",
        rawText: "/resume",
        userId: 123,
        threadId: "telegram:1",
        timezone: "Asia/Seoul"
      },
      deps
    );

    expect(deps.setReminderPaused).toHaveBeenCalledWith(123, false);
    expect(result.text).toContain("다시 시작");
  });

  it("/summary uses summary builder", async () => {
    const deps = buildDeps();

    const result = await executeAssistantCommand(
      {
        botId: "tyler_durden",
        command: "/summary",
        rawText: "/summary",
        userId: 123,
        threadId: "telegram:1",
        timezone: "Asia/Seoul"
      },
      deps
    );

    expect(deps.buildSummary).toHaveBeenCalledWith("telegram:1", "Asia/Seoul", "tyler_durden");
    expect(result.text).toBe("요약 결과");
  });

  it("/help contains SENTRY and no GUARD", async () => {
    const result = await executeAssistantCommand({
      botId: "tyler_durden",
      command: "/help",
      rawText: "/help",
      userId: 123,
      threadId: "telegram:1",
      timezone: "Asia/Seoul",
      languageCode: "ko-KR"
    });

    expect(result.text).toContain("SENTRY");
    expect(result.text).not.toContain("GUARD");
  });

  it("/ops shows automation flow list", async () => {
    const result = await executeAssistantCommand({
      botId: "tyler_durden",
      command: "/ops",
      rawText: "/ops",
      userId: 123,
      threadId: "telegram:1",
      timezone: "Asia/Seoul",
      languageCode: "ko-KR"
    });

    expect(result.text).toContain("자동 운영 플로우");
    expect(result.text).toContain("market_3h");
    expect(result.text).toContain("gmat_mba_daily");
  });

  it("/mayhem returns kickoff message", async () => {
    const result = await executeAssistantCommand({
      botId: "tyler_durden",
      command: "/mayhem",
      rawText: "/mayhem",
      userId: 123,
      threadId: "telegram:1",
      timezone: "Asia/Seoul",
      languageCode: "ko-KR"
    });

    expect(result.text).toContain("MAYHEM 회의 시작");
    expect(result.text).toContain("Tyler.Durden");
  });

  it("detects explicit structured output requests", () => {
    expect(__private_requestsStructuredOutput("json으로 줘")).toBe(true);
    expect(__private_requestsStructuredOutput("일반 문장으로 정리해줘")).toBe(false);
  });

  it("converts LENS JSON reply to plain text", () => {
    const raw = JSON.stringify({
      conclusion: "가능합니다.",
      findings: [
        {
          claim: "헤드라인 기반 정리",
          label: "FACT"
        }
      ],
      risks: ["원문 검증 필요"],
      actions_48h: [
        {
          action: "원문 링크 확보",
          dod: "핵심 수치 3개 검증"
        }
      ]
    });

    const converted = __private_formatLensJsonToPlainText(raw);
    expect(converted).toContain("핵심 결론:");
    expect(converted).toContain("근거:");
    expect(converted).toContain("다음 48시간 액션:");
    expect(converted).not.toBe(raw);
  });

  it("converts mixed text + JSON LENS reply to plain text", () => {
    const raw = [
      "가능합니다. 아래 JSON 참고.",
      JSON.stringify({
        conclusion: "원문 링크 확인 필요",
        findings: [{ claim: "헤드라인 5개 수신", label: "FACT" }],
        actions_48h: [{ action: "원문 URL 수집", dod: "링크 5개 확인" }]
      })
    ].join("\n");

    const converted = __private_formatLensJsonToPlainText(raw);
    expect(converted).toContain("핵심 결론:");
    expect(converted).toContain("근거:");
    expect(converted).toContain("다음 48시간 액션:");
  });

  it("routes long research requests to local queue", () => {
    const config = buildConfig();
    const result = __private_shouldQueueLocalHeavy(
      "zhuge_liang",
      "시장 리서치 딥다이브 보고서 작성해줘",
      config,
      false
    );
    expect(result).toBe(true);
  });

  it("does not queue structured-output requests", () => {
    const config = buildConfig();
    const result = __private_shouldQueueLocalHeavy(
      "zhuge_liang",
      "json으로 응답해줘",
      config,
      true
    );
    expect(result).toBe(false);
  });

  it("respects local heavy bot allowlist", () => {
    const config = buildConfig({
      localHeavyEnableBots: new Set(["zhuge_liang"])
    });
    const result = __private_shouldQueueLocalHeavy(
      "alfred_sentry",
      "긴 글로 아티클 써줘",
      config,
      false
    );
    expect(result).toBe(false);
  });
});
