import { LEGAL_DISCLAIMER } from "@/lib/legal";
import type {
  DailyFortune,
  FullReport,
  InviteRedeemResult,
  PreviewReport,
  UserProfile
} from "@/lib/types";

const TOPIC_ACTION: Record<UserProfile["concernTopic"], string> = {
  love: "이번 주에는 먼저 연락 1회를 실행해 감정의 흐름을 열어보세요.",
  career: "48시간 내에 포트폴리오 또는 이력서 항목 1개를 개선하세요.",
  relationship: "불편했던 관계 1건에 대해 경계 문장을 짧게 정리해 전달하세요.",
  wealth: "이번 주 소비 로그를 3분류로 나눠 불필요 구독 1개를 정리하세요.",
  health: "매일 같은 시간 20분 산책 루틴을 7일 중 5일 실행하세요."
};

function zodiacByBirthDate(dateString: string): string {
  const date = new Date(dateString);
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if ((month === 1 && day >= 20) || (month === 2 && day <= 18)) return "물병";
  if ((month === 2 && day >= 19) || (month === 3 && day <= 20)) return "물고기";
  if ((month === 3 && day >= 21) || (month === 4 && day <= 19)) return "양";
  if ((month === 4 && day >= 20) || (month === 5 && day <= 20)) return "황소";
  if ((month === 5 && day >= 21) || (month === 6 && day <= 21)) return "쌍둥이";
  if ((month === 6 && day >= 22) || (month === 7 && day <= 22)) return "게";
  if ((month === 7 && day >= 23) || (month === 8 && day <= 22)) return "사자";
  if ((month === 8 && day >= 23) || (month === 9 && day <= 23)) return "처녀";
  if ((month === 9 && day >= 24) || (month === 10 && day <= 22)) return "천칭";
  if ((month === 10 && day >= 23) || (month === 11 && day <= 22)) return "전갈";
  if ((month === 11 && day >= 23) || (month === 12 && day <= 24)) return "사수";
  return "염소";
}

export function buildPreview(profile: UserProfile, reportId: string): PreviewReport {
  const zodiac = zodiacByBirthDate(profile.birthDate);
  const summary: [string, string, string] = [
    `${profile.name}님의 현재 에너지는 ${zodiac} 기운과 맞물려 추진력이 높아지는 구간입니다.`,
    "이번 2주 동안 인간관계에서 먼저 선을 명확히 할수록 운의 효율이 올라갑니다.",
    "작은 실행 1개가 다음 기회를 당기는 구조라서 즉시 행동이 핵심입니다."
  ];

  return {
    reportId,
    sessionId: profile.sessionId,
    summary,
    actionCard: TOPIC_ACTION[profile.concernTopic],
    blurredDetail:
      "이번 달 핵심운은 3번째 주에 강하게 열리며, 특히 관계/금전/진로 중 선택한 영역에서 확장 신호가 들어옵니다. 다만 감정적 의사결정은 손실 확률을 높이므로 24시간 룰을 적용하세요.",
    priceKRW: 990,
    createdAt: new Date().toISOString()
  };
}

export function buildFullReport(profile: UserProfile, reportId: string): FullReport {
  const zodiac = zodiacByBirthDate(profile.birthDate);

  return {
    reportId,
    sessionId: profile.sessionId,
    sections: {
      love: `${zodiac} 흐름상 감정 표현을 먼저 열면 관계의 응답 속도가 빨라집니다. 이번 주는 확인보다 제안형 대화가 유리합니다.`,
      wealth:
        "지출 패턴에서 반복 결제 누수가 보입니다. 고정비 1건 정리만으로도 이번 달 체감 여유가 커질 가능성이 높습니다.",
      relationship:
        "경계 설정이 운을 지키는 핵심입니다. 부탁을 바로 수락하기보다 일정 확인 후 응답하는 방식이 갈등을 줄입니다.",
      career:
        "성과는 ‘새로운 시작’보다 ‘기존 자산 재정리’에서 먼저 나옵니다. 포트폴리오의 첫 30초를 전면 수정하세요.",
      health:
        "집중력 저하 신호가 누적되는 패턴입니다. 수면 리듬과 카페인 섭취 시점을 고정하면 컨디션 변동이 줄어듭니다."
    },
    weeklyActionCard: TOPIC_ACTION[profile.concernTopic],
    disclaimer: LEGAL_DISCLAIMER,
    createdAt: new Date().toISOString()
  };
}

export function buildInviteResult(ownerName: string, redeemerName: string, code: string): InviteRedeemResult {
  const seed = [...code].reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const compatibilityScore = 60 + (seed % 36);

  return {
    code,
    ownerSessionId: "",
    redeemerSessionId: "",
    compatibilityScore,
    summary: `${ownerName}님과 ${redeemerName}님의 궁합 포인트는 대화 템포 일치입니다. 결정은 빠르게, 감정은 천천히 맞추는 조합이 좋습니다.`
  };
}

export function buildDailyFortune(date: string, sessionId?: string): DailyFortune {
  const bucket = new Date(date).getDate() % 5;
  const liners = [
    "오늘은 먼저 연락하는 쪽이 기회를 잡습니다.",
    "결정은 짧게, 실행은 바로 시작하는 날입니다.",
    "작은 정리 1개가 다음 성과를 엽니다.",
    "회피하던 대화 1개를 끝내면 흐름이 바뀝니다.",
    "속도를 낮추면 오히려 결과가 빨라지는 날입니다."
  ];

  const actions = [
    "오늘의 핵심 연락 1건 완료",
    "할 일 우선순위 상위 1개만 마감",
    "지출 로그 3개 기록",
    "불필요한 약속 1개 정리",
    "20분 산책 또는 스트레칭"
  ];

  return {
    date,
    sessionId,
    oneLiner: liners[bucket],
    actionCheck: actions[bucket]
  };
}
