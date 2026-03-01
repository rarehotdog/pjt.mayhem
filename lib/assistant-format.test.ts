import { describe, expect, it } from "vitest";

import {
  buildCompactNewsPrompt,
  buildWarRoomBriefingPrompt,
  buildWarRoomBriefingTemplate,
  buildCompactNewsTemplate,
  resolveCompactNewsCount
} from "@/lib/assistant-format";

describe("assistant-format compact news", () => {
  it("uses default news count=5", () => {
    const template = buildCompactNewsTemplate();
    const count = (template.match(/✅ 뉴스 /g) ?? []).length;
    expect(count).toBe(5);
    expect(template).toContain("## 🧩 뉴스 블록");
    expect(template).toContain("## 📊 종합 데이터 분석 요약");
  });

  it("normalizes invalid counts to default", () => {
    expect(resolveCompactNewsCount(0)).toBe(5);
    expect(resolveCompactNewsCount(undefined)).toBe(5);
    expect(resolveCompactNewsCount(3)).toBe(3);
  });

  it("builds prompt with fixed structure rules", () => {
    const prompt = buildCompactNewsPrompt({
      title: "시장/국제 뉴스 3시간 브리핑",
      now: new Date("2026-02-28T13:35:00.000Z"),
      timezone: "Asia/Seoul",
      contextFocus: ["국내+해외 혼합", "중요도 별점"]
    });

    expect(prompt).toContain("정확히 5개");
    expect(prompt).toContain("중요도(★)");
    expect(prompt).toContain("종합 데이터 분석 요약");
    expect(prompt).toContain("내일 체크포인트");
  });

  it("builds morning war room template with game status", () => {
    const template = buildWarRoomBriefingTemplate({
      kind: "morning_plan",
      count: 5
    });
    expect(template).toContain("🎮 GAME STATUS");
    expect(template).toContain("🎯 오늘 Top3");
    expect(template).toContain("⚡ 지금 15분 액션");
  });

  it("builds evening war room prompt with vision check", () => {
    const prompt = buildWarRoomBriefingPrompt({
      kind: "evening_review",
      title: "이브닝 리뷰 (/review)",
      now: new Date("2026-02-28T13:35:00.000Z"),
      timezone: "Asia/Seoul",
      count: 5,
      contextFocus: ["마감 리스크", "다음 날 체크포인트"]
    });
    expect(prompt).toContain("🧠 Vision vs Anti-Vision 체크");
    expect(prompt).toContain("Mission 코드는 M1/M2/M3/M4/M5/Mx");
    expect(prompt).toContain("뉴스 개수: 정확히 5개");
  });
});
