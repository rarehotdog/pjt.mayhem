export type CalendarType = "solar" | "lunar";
export type Gender = "male" | "female" | "other";
export type ConcernTopic = "love" | "career" | "relationship" | "wealth" | "health";

export interface AttributionParams {
  campaign_id?: string;
  click_source?: string;
  partition?: string;
  ua_creative_topic?: string;
  utm_source?: string;
  source?: string;
  mode?: string;
}

export interface ConsentState {
  essentialAnalytics: true;
  marketingTracking: boolean;
  updatedAt: string;
}

export interface SessionData {
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  userAgent?: string;
  attribution?: AttributionParams;
}

export interface UserProfile {
  sessionId: string;
  name: string;
  birthDate: string;
  birthTime?: string;
  isBirthTimeUnknown: boolean;
  calendarType: CalendarType;
  gender: Gender;
  concernTopic: ConcernTopic;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewReport {
  reportId: string;
  sessionId: string;
  summary: [string, string, string];
  actionCard: string;
  blurredDetail: string;
  priceKRW: number;
  createdAt: string;
}

export interface FullReport {
  reportId: string;
  sessionId: string;
  sections: {
    love: string;
    wealth: string;
    relationship: string;
    career: string;
    health: string;
  };
  weeklyActionCard: string;
  disclaimer: string;
  createdAt: string;
}

export type PaymentStatus = "created" | "paid" | "failed" | "cancelled";
export type PaymentProductCode = "single_990" | "premium_monthly_4900" | "special_2900";

export interface PaymentOrder {
  orderId: string;
  sessionId: string;
  reportId: string;
  productCode: PaymentProductCode;
  amountKRW: number;
  currency: "KRW";
  status: PaymentStatus;
  provider: "portone";
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
}

export interface Entitlement {
  entitlementId: string;
  sessionId: string;
  reportId: string;
  productCode: PaymentProductCode;
  status: "active" | "expired";
  createdAt: string;
  expiresAt?: string;
}

export interface ShareCard {
  cardId: string;
  reportId: string;
  sessionId: string;
  headline: string;
  subline: string;
  actionLine: string;
  imageSvgDataUrl: string;
  createdAt: string;
}

export interface InviteLink {
  code: string;
  ownerSessionId: string;
  reportId: string;
  createdAt: string;
  redeemedBy: string[];
}

export interface InviteRedeemResult {
  code: string;
  ownerSessionId: string;
  redeemerSessionId: string;
  compatibilityScore: number;
  summary: string;
}

export interface DailyFortune {
  date: string;
  sessionId?: string;
  oneLiner: string;
  actionCheck: string;
}

export type TelemetryEventType = "product" | "marketing" | "system";
export type TelemetryDestinationStatus = "pending" | "sent" | "failed" | "skipped";

export interface TelemetryDeliveryStatus {
  amplitude: Exclude<TelemetryDestinationStatus, "skipped">;
  meta: TelemetryDestinationStatus;
}

export interface TelemetryEvent {
  eventId: string;
  eventName: string;
  eventType: TelemetryEventType;
  eventTime: string;
  sessionId?: string;
  pagePath: string;
  sourceChannel: string;
  consentMarketing: boolean;
  payload: Record<string, unknown>;
  attribution: AttributionParams;
  delivery: TelemetryDeliveryStatus;
  retryCount: number;
  createdAt: string;
}

export interface EventDeliveryLog {
  eventId: string;
  destination: "amplitude" | "meta";
  status: TelemetryDestinationStatus;
  attempt: number;
  error?: string;
  createdAt: string;
}
