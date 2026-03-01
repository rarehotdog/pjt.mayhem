import { describe, expect, it } from "vitest";

import {
  __private_buildOpsPrompt,
  OPS_FLOW_IDS,
  buildMayhemKickoffMessage,
  buildOpsStatusMessage,
  isOpsFlowId,
  listOpsFlowSpecs
} from "@/lib/assistant-ops";

describe("assistant-ops", () => {
  it("has flow specs for all flow ids", () => {
    expect(listOpsFlowSpecs()).toHaveLength(OPS_FLOW_IDS.length);
  });

  it("validates flow ids", () => {
    expect(isOpsFlowId("market_3h")).toBe(true);
    expect(isOpsFlowId("unknown_flow")).toBe(false);
  });

  it("builds ops status message", () => {
    const message = buildOpsStatusMessage("ko-KR");
    expect(message).toContain("자동 운영 플로우");
    expect(message).toContain("market_3h");
    expect(message).toContain("product_wbs_daily");
    expect(message).toContain("autopilot_interrupt_daily");
    expect(message).toContain("game_score_monthly");
  });

  it("builds mayhem kickoff message", () => {
    const message = buildMayhemKickoffMessage("Asia/Seoul");
    expect(message).toContain("MAYHEM 회의 시작");
    expect(message).toContain("Tyler.Durden");
  });

  it("uses compact news format rules for market_3h prompt", () => {
    const prompt = __private_buildOpsPrompt("market_3h", new Date("2026-02-28T13:35:00.000Z"), "Asia/Seoul");
    expect(prompt).toContain("국내+해외");
    expect(prompt).toContain("정확히 5개");
    expect(prompt).toContain("## 🧩 뉴스 블록");
    expect(prompt).toContain("## 📊 종합 데이터 분석 요약");
    expect(prompt).toContain("중요도(★)");
  });

  it("uses emperor curriculum format for world_knowledge_daily prompt", () => {
    const prompt = __private_buildOpsPrompt(
      "world_knowledge_daily",
      new Date("2026-03-02T13:00:00.000Z"),
      "Asia/Seoul"
    );
    expect(prompt).toContain("S4 제왕의 수업");
    expect(prompt).toContain("핵심 인물 1명");
    expect(prompt).toContain("핵심 질문");
  });
});
