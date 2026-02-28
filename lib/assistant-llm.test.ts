import { describe, expect, it } from "vitest";

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
  it("builds zhuge prompt with no-json default rule", () => {
    const prompt = __private_buildSystemPrompt("Asia/Seoul", "zhuge_liang");
    expect(prompt).toContain("제갈량");
    expect(prompt).toContain("JSON/객체 스키마로 답하지 않습니다");
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
