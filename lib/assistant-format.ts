const DEFAULT_NEWS_COUNT = 5;

interface CompactNewsOptions {
  count?: number;
  mix?: "domestic+global";
}

export function resolveCompactNewsCount(count: number | undefined): number {
  if (typeof count !== "number" || !Number.isInteger(count) || count < 1) {
    return DEFAULT_NEWS_COUNT;
  }
  return count;
}

export function buildCompactNewsTemplate(options?: CompactNewsOptions): string {
  const count = resolveCompactNewsCount(options?.count);
  const mix = options?.mix ?? "domestic+global";
  const mixLabel = mix === "domestic+global" ? "국내+해외 혼합" : mix;

  const blocks = Array.from({ length: count }, (_, index) =>
    [
      `✅ 뉴스 ${index + 1} 제목 / 출처 (중요도: ★★★★☆)`,
      "• 주요 내용 1",
      "• 주요 내용 2",
      "• 주요 내용 3"
    ].join("\n")
  ).join("\n\n");

  return [
    "## 🧩 뉴스 블록",
    `- 구성: ${mixLabel}, 총 ${count}개`,
    "",
    blocks,
    "",
    "---",
    "",
    "## 📊 종합 데이터 분석 요약",
    "",
    "1. 요약 1",
    "- 근거 1",
    "- 근거 2",
    "",
    "2. 요약 2",
    "- 근거 1",
    "- 근거 2",
    "",
    "3. 요약 3",
    "- 근거 1",
    "- 근거 2",
    "",
    "전망 1",
    "- 근거 1",
    "- 근거 2",
    "- 근거 3",
    "",
    "전망 2",
    "- 근거 1",
    "- 근거 2",
    "- 근거 3",
    "",
    "종합 정리",
    "- 3줄 이내 결론",
    "- 내일 체크포인트 1줄"
  ].join("\n");
}

export function buildCompactNewsImportanceRules(): string {
  return [
    "중요도(★) 내부 기준:",
    "- ★★★★★: 지수/금리/환율/정책/빅테크 실적 등 즉시 시장 방향",
    "- ★★★★☆: 섹터 방향성/대형 이벤트 예고/수급 급변 유발",
    "- ★★★☆☆: 개별 종목·산업 이슈(파급 제한적)",
    "- ★★☆☆☆: 참고용(배경/해설)",
    "- ★☆☆☆☆: 단신(가급적 제외)"
  ].join("\n");
}

export function buildCompactNewsPrompt(options: {
  title: string;
  now: Date;
  timezone: string;
  count?: number;
  contextFocus: string[];
}) {
  const count = resolveCompactNewsCount(options.count);
  const timestamp = options.now.toISOString();

  return [
    `작업: ${options.title}`,
    `기준시각: ${timestamp} (${options.timezone})`,
    "언어: 한국어",
    `뉴스 개수: 정확히 ${count}개`,
    "필수 규칙:",
    "- 국내+해외 뉴스를 반드시 혼합",
    "- 각 뉴스는 중요도 별표(★) 포함",
    "- 각 뉴스 블록은 제목/출처 + 주요 내용 3개 불릿",
    "- 마지막은 종합 데이터 분석 요약 포맷 고정",
    "- 종합 정리는 3줄 이내 결론 + 내일 체크포인트 1줄",
    "- 최신 수치가 불명확하면 TODO-VERIFY로 명시",
    "",
    "포커스:",
    ...options.contextFocus.map((line) => `- ${line}`),
    "",
    buildCompactNewsImportanceRules(),
    "",
    "아래 템플릿 구조를 그대로 사용해서 결과를 작성:",
    buildCompactNewsTemplate({
      count,
      mix: "domestic+global"
    })
  ].join("\n");
}

export function buildCompactNewsFallback(kind: "morning_plan" | "evening_review"): string {
  if (kind === "morning_plan") {
    return "모닝 브리핑 생성이 지연되었습니다. 오늘 핵심 이슈 1개와 첫 실행 행동 1개를 먼저 정해 주세요.";
  }
  return "이브닝 리뷰 생성이 지연되었습니다. 오늘 리스크 1개와 내일 체크포인트 1개를 먼저 정리해 주세요.";
}
