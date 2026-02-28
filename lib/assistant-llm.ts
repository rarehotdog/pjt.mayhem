import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

import type { AssistantBotId } from "@/lib/assistant-types";
import { getAssistantConfig } from "@/lib/assistant-config";
import type {
  AssistantHistoryMessage,
  AssistantProviderName,
  AssistantProviderResult
} from "@/lib/assistant-types";
import { sanitizeErrorMessage } from "@/lib/assistant-utils";

const DEFAULT_TIMEOUT_MS = 16_000;
const DEFAULT_MAX_OUTPUT_TOKENS = 700;
const DEFAULT_TEMPERATURE = 0.7;

export interface AssistantGenerationInput {
  history: AssistantHistoryMessage[];
  userText: string;
  timezone: string;
  botId?: AssistantBotId;
  maxOutputTokens?: number;
  temperature?: number;
}

export interface AssistantLlmRunner {
  generateOpenAi(input: AssistantGenerationInput): Promise<{
    text: string;
    model: string;
    tokensIn?: number;
    tokensOut?: number;
  }>;
  generateAnthropic(input: AssistantGenerationInput): Promise<{
    text: string;
    model: string;
    tokensIn?: number;
    tokensOut?: number;
  }>;
}

function buildRolePrompt(botId: AssistantBotId) {
  if (botId === "zhuge_liang") {
    return [
      "당신은 제갈량(LENS)입니다. 근거 중심으로 짧고 명확하게 답합니다.",
      "핵심 결론 1줄, 근거 2~3줄, 바로 할 다음 행동 1~2줄로 정리합니다.",
      "중요: 사용자가 명시적으로 'JSON으로' 요청하지 않으면 JSON/객체 스키마로 답하지 않습니다.",
      "이전 대화에 JSON 예시가 있어도 일반 문장/불릿 형식을 유지합니다."
    ].join("\n");
  }

  if (botId === "jensen_huang") {
    return [
      "당신은 Jensen Huang(BOLT)입니다. 실행/마감 중심으로 답합니다.",
      "항상 지금 15분 액션과 오늘 마감 기준(DoD)을 포함합니다."
    ].join("\n");
  }

  if (botId === "hemingway_ernest") {
    return [
      "당신은 Hemingway, Ernest(INK)입니다. 콘텐츠 훅과 구조를 명확하게 제시합니다.",
      "짧은 문장, 강한 첫 문장, 마지막 CTA를 우선합니다."
    ].join("\n");
  }

  if (botId === "alfred_sentry") {
    return [
      "당신은 Alfred.Sentry(SENTRY)입니다. 리스크/보안/비용 관점으로 검토합니다.",
      "지적만 하지 말고 항상 대안을 함께 제시합니다."
    ].join("\n");
  }

  return [
    "당신은 Tyler.Durden(오케스트레이터)입니다.",
    "요청을 짧게 정리하고, 결정 1개와 실행 액션 1~3개로 답합니다."
  ].join("\n");
}

function buildSystemPrompt(timezone: string, botId: AssistantBotId = "tyler_durden") {
  return [
    buildRolePrompt(botId),
    "당신은 개인용 자동 AI 비서입니다.",
    "기본 언어는 한국어이며, 간결하고 실행 가능한 답변을 제공합니다.",
    "과장, 단정, 의료/법률/투자 확정 표현을 피합니다.",
    "필요하면 질문 1개로 맥락을 보완하고 바로 실행 가능한 다음 행동을 제안합니다.",
    `기준 시간대: ${timezone}`
  ].join("\n");
}

function toOpenAiInput(input: AssistantGenerationInput) {
  const history = input.history
    .map((message, index) => `${index + 1}. ${message.role}: ${message.content}`)
    .join("\n");

  return [
    buildSystemPrompt(input.timezone, input.botId),
    "",
    "최근 대화 기록:",
    history || "(없음)",
    "",
    "사용자 최신 요청:",
    input.userText
  ].join("\n");
}

function extractOpenAiText(response: unknown): string {
  const payload = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };

  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const joined =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" || item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n")
      .trim() ?? "";

  if (joined) {
    return joined;
  }

  throw new Error("OpenAI Responses API returned empty output.");
}

function extractAnthropicText(response: unknown): string {
  const payload = response as { content?: Array<{ type?: string; text?: string }> };
  const text =
    payload.content
      ?.filter((item) => item.type === "text")
      .map((item) => item.text ?? "")
      .join("\n")
      .trim() ?? "";

  if (!text) {
    throw new Error("Anthropic Messages API returned empty output.");
  }

  return text;
}

function parseUsage(response: unknown): { tokensIn?: number; tokensOut?: number } {
  const payload = response as {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };

  const tokensIn = payload.usage?.input_tokens;
  const tokensOut = payload.usage?.output_tokens;
  return {
    tokensIn: Number.isFinite(tokensIn) ? Number(tokensIn) : undefined,
    tokensOut: Number.isFinite(tokensOut) ? Number(tokensOut) : undefined
  };
}

function parseOpenAiUsage(response: unknown): { tokensIn?: number; tokensOut?: number } {
  const payload = response as {
    usage?: {
      input_tokens?: number;
      output_tokens?: number;
    };
  };
  const tokensIn = payload.usage?.input_tokens;
  const tokensOut = payload.usage?.output_tokens;
  return {
    tokensIn: Number.isFinite(tokensIn) ? Number(tokensIn) : undefined,
    tokensOut: Number.isFinite(tokensOut) ? Number(tokensOut) : undefined
  };
}

function parseRate(raw: string | undefined, fallback: number): number {
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function estimateCostUsd(provider: AssistantProviderName, tokensIn?: number, tokensOut?: number) {
  const input = tokensIn ?? 0;
  const output = tokensOut ?? 0;
  if (input === 0 && output === 0) {
    return 0;
  }

  if (provider === "openai") {
    const inputPer1k = parseRate(process.env.OPENAI_INPUT_COST_PER_1K, 0.001);
    const outputPer1k = parseRate(process.env.OPENAI_OUTPUT_COST_PER_1K, 0.003);
    return Number((((input / 1000) * inputPer1k) + ((output / 1000) * outputPer1k)).toFixed(6));
  }

  if (provider === "anthropic") {
    const inputPer1k = parseRate(process.env.ANTHROPIC_INPUT_COST_PER_1K, 0.003);
    const outputPer1k = parseRate(process.env.ANTHROPIC_OUTPUT_COST_PER_1K, 0.015);
    return Number((((input / 1000) * inputPer1k) + ((output / 1000) * outputPer1k)).toFixed(6));
  }

  return 0;
}

function resolveTimeoutMs() {
  const raw = Number(process.env.ASSISTANT_LLM_TIMEOUT_MS);
  return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

let openAiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

function getOpenAiClient(apiKey: string) {
  if (!openAiClient) {
    openAiClient = new OpenAI({ apiKey });
  }
  return openAiClient;
}

function getAnthropicClient(apiKey: string) {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

export function createDefaultAssistantLlmRunner(): AssistantLlmRunner {
  const config = getAssistantConfig();

  return {
    async generateOpenAi(input) {
      if (!config.openAiApiKey) {
        throw new Error("OPENAI_API_KEY is not configured.");
      }

      const client = getOpenAiClient(config.openAiApiKey);
      const response = await client.responses.create(
        {
          model: config.openAiModel,
          input: toOpenAiInput(input),
          temperature: input.temperature ?? DEFAULT_TEMPERATURE,
          max_output_tokens: input.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS
        },
        {
          signal: AbortSignal.timeout(resolveTimeoutMs())
        }
      );

      return {
        text: extractOpenAiText(response),
        model: config.openAiModel,
        ...parseOpenAiUsage(response)
      };
    },
    async generateAnthropic(input) {
      if (!config.anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY is not configured.");
      }

      const client = getAnthropicClient(config.anthropicApiKey);
      const response = await client.messages.create(
        {
          model: config.anthropicModel,
          system: buildSystemPrompt(input.timezone, input.botId),
          max_tokens: input.maxOutputTokens ?? 800,
          temperature: input.temperature ?? DEFAULT_TEMPERATURE,
          messages: [
            ...input.history.map((message) => ({
              role: message.role,
              content: message.content
            })),
            {
              role: "user",
              content: input.userText
            }
          ]
        },
        {
          signal: AbortSignal.timeout(resolveTimeoutMs())
        }
      );

      return {
        text: extractAnthropicText(response),
        model: config.anthropicModel,
        ...parseUsage(response)
      };
    }
  };
}

export async function generateAssistantReply(
  input: AssistantGenerationInput,
  runner: AssistantLlmRunner = createDefaultAssistantLlmRunner()
): Promise<AssistantProviderResult> {
  let openAiError: string | undefined;
  const openAiStart = Date.now();

  try {
    const openAiResult = await runner.generateOpenAi(input);
    return {
      provider: "openai",
      model: openAiResult.model,
      outputText: openAiResult.text,
      latencyMs: Date.now() - openAiStart,
      tokensIn: openAiResult.tokensIn,
      tokensOut: openAiResult.tokensOut,
      estimatedCostUsd: estimateCostUsd("openai", openAiResult.tokensIn, openAiResult.tokensOut)
    };
  } catch (caught) {
    openAiError = sanitizeErrorMessage(caught);
  }

  const anthropicStart = Date.now();
  try {
    const anthropicResult = await runner.generateAnthropic(input);
    return {
      provider: "anthropic",
      model: anthropicResult.model,
      outputText: anthropicResult.text,
      latencyMs: Date.now() - anthropicStart,
      tokensIn: anthropicResult.tokensIn,
      tokensOut: anthropicResult.tokensOut,
      estimatedCostUsd: estimateCostUsd(
        "anthropic",
        anthropicResult.tokensIn,
        anthropicResult.tokensOut
      ),
      fallbackFrom: "openai",
      error: openAiError
    };
  } catch (caught) {
    const anthropicError = sanitizeErrorMessage(caught);
    throw new Error(
      `Both providers failed. openai=${openAiError ?? "unknown"} anthropic=${anthropicError}`
    );
  }
}

export async function generateConversationSummary(
  history: AssistantHistoryMessage[],
  timezone: string,
  runner: AssistantLlmRunner = createDefaultAssistantLlmRunner()
) {
  const summaryPrompt = [
    "아래 최근 대화를 5줄 이내로 요약해줘.",
    "형식:",
    "1) 핵심 목표",
    "2) 진행 상태",
    "3) 막힌 지점",
    "4) 다음 행동 1개",
    "5) 오늘 리마인드 문장 1개"
  ].join("\n");

  return generateAssistantReply(
    {
      history,
      userText: summaryPrompt,
      timezone
    },
    runner
  );
}

export function __private_providerName(result: AssistantProviderResult): AssistantProviderName {
  return result.provider;
}

export function __private_buildSystemPrompt(
  timezone: string,
  botId: AssistantBotId = "tyler_durden"
) {
  return buildSystemPrompt(timezone, botId);
}
