import { describe, expect, it } from "vitest";

import {
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
  });

  it("builds mayhem kickoff message", () => {
    const message = buildMayhemKickoffMessage("Asia/Seoul");
    expect(message).toContain("MAYHEM 회의 시작");
    expect(message).toContain("Tyler.Durden");
  });
});
