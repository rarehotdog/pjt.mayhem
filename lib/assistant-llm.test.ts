import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  __private_buildSystemPrompt,
  generateAssistantReply,
  type AssistantGenerationInput
} from "@/lib/assistant-llm";

const sampleInput: AssistantGenerationInput = {
  history: [
    {
      role: "user",
      content: "오늘 우선순위 정리해줘",
      createdAt: new Date().toISOString()
    }
  ],
  userText: "회의 전에 할 일 3개만 말해줘",
  timezone: "Asia/Seoul"
};

describe("assistant-llm fallback", () => {
  const envSnapshot = {
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    OPENAI_MODEL_CANDIDATES: process.env.OPENAI_MODEL_CANDIDATES
  };

  beforeEach(() => {
    process.env.OPENAI_MODEL = "gpt-5.2";
    process.env.OPENAI_MODEL_CANDIDATES = "gpt-5.2,gpt-5.1,gpt-5";
  });

  afterEach(() => {
    process.env.OPENAI_MODEL = envSnapshot.OPENAI_MODEL;
    process.env.OPENAI_MODEL_CANDIDATES = envSnapshot.OPENAI_MODEL_CANDIDATES;
  });

  it("builds zhuge prompt with no-json default rule", () => {
    const prompt = __private_buildSystemPrompt("Asia/Seoul", "zhuge_liang");
    expect(prompt).toContain("제갈량");
    expect(prompt).toContain("JSON/객체 스키마로 답하지 않습니다");
    expect(prompt).toContain("[Cybernetic Role: 감지기]");
    expect(prompt).toContain("[GAME BOARD — Tyler's 2026]");
  });

  it("builds tyler prompt with mission game board", () => {
    const prompt = __private_buildSystemPrompt("Asia/Seoul", "tyler_durden");
    expect(prompt).toContain("M1 SCHOLAR");
    expect(prompt).toContain("M5 EMPEROR");
    expect(prompt).toContain("Vision vs Anti-Vision");
  });

  it("returns openai result when primary succeeds", async () => {
    const result = await generateAssistantReply(sampleInput, {
      async generateOpenAi() {
        return {
          text: "1) 회의 아젠다 2) 자료 링크 3) 의사결정 항목",
          model: "gpt-5.2"
        };
      },
      async generateAnthropic() {
        throw new Error("should not be called");
      }
    });

    expect(result.provider).toBe("openai");
    expect(result.outputText).toContain("회의");
    expect(result.fallbackFrom).toBeUndefined();
  });

  it("falls back to anthropic when openai fails", async () => {
    const result = await generateAssistantReply(sampleInput, {
      async generateOpenAi() {
        throw new Error("openai timeout");
      },
      async generateAnthropic() {
        return {
          text: "백업 모델 응답입니다.",
          model: "claude-sonnet-4-5"
        };
      }
    });

    expect(result.provider).toBe("anthropic");
    expect(result.fallbackFrom).toBe("openai");
    expect(result.outputText).toContain("백업");
  });

  it("tries openai model candidates in order", async () => {
    const attempts: string[] = [];

    const result = await generateAssistantReply(sampleInput, {
      async generateOpenAi(_, options) {
        const model = options?.modelOverride ?? "unknown";
        attempts.push(model);
        if (model === "gpt-5.2") {
          throw new Error("model not available");
        }
        return {
          text: "후보 모델로 성공",
          model
        };
      },
      async generateAnthropic() {
        throw new Error("should not be called");
      }
    });

    expect(attempts).toEqual(["gpt-5.2", "gpt-5.1"]);
    expect(result.provider).toBe("openai");
    expect(result.model).toBe("gpt-5.1");
    expect(result.metadata?.openAiAttemptedModels).toEqual(["gpt-5.2", "gpt-5.1"]);
  });

  it("throws when both providers fail", async () => {
    await expect(
      generateAssistantReply(sampleInput, {
        async generateOpenAi() {
          throw new Error("openai down");
        },
        async generateAnthropic() {
          throw new Error("anthropic down");
        }
      })
    ).rejects.toThrow("Both providers failed");
  });
});
