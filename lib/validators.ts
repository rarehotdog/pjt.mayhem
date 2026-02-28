import { z } from "zod";

export const attributionSchema = z
  .object({
    campaign_id: z.string().optional(),
    click_source: z.string().optional(),
    partition: z.string().optional(),
    ua_creative_topic: z.string().optional(),
    utm_source: z.string().optional(),
    source: z.string().optional(),
    mode: z.string().optional()
  })
  .default({});

export const consentSchema = z.object({
  essentialAnalytics: z.literal(true).default(true),
  marketingTracking: z.boolean().default(false),
  updatedAt: z.string().default(() => new Date().toISOString())
});

export const consentUpdateSchema = z.object({
  marketingTracking: z.boolean()
});

export const startSessionSchema = z.object({
  attribution: attributionSchema.optional(),
  userAgent: z.string().optional()
});

export const profileSchema = z.object({
  sessionId: z.string().optional(),
  name: z.string().min(1),
  birthDate: z.string().min(8),
  birthTime: z.string().optional(),
  isBirthTimeUnknown: z.boolean().default(false),
  calendarType: z.enum(["solar", "lunar"]),
  gender: z.enum(["male", "female", "other"]),
  concernTopic: z.enum(["love", "career", "relationship", "wealth", "health"]),
  attribution: attributionSchema.optional()
});

export const previewSchema = z.object({
  sessionId: z.string().optional()
});

export const paymentCreateSchema = z.object({
  sessionId: z.string().optional(),
  reportId: z.string().min(1),
  productCode: z.enum(["single_990", "premium_monthly_4900", "special_2900"]).default("single_990"),
  idempotencyKey: z.string().optional()
});

export const paymentConfirmSchema = z.object({
  sessionId: z.string().optional(),
  orderId: z.string().min(1),
  paymentId: z.string().optional(),
  status: z.enum(["paid", "failed", "cancelled"]).default("paid")
});

export const shareCardSchema = z.object({
  sessionId: z.string().optional(),
  reportId: z.string().min(1)
});

export const inviteCreateSchema = z.object({
  sessionId: z.string().optional(),
  reportId: z.string().min(1)
});

export const inviteRedeemSchema = z.object({
  sessionId: z.string().optional(),
  code: z.string().min(4),
  partnerName: z.string().min(1).max(20).default("상대")
});

export const telemetryV2Schema = z.object({
  eventId: z.string().min(6).optional(),
  eventName: z.string().min(1),
  sessionId: z.string().optional(),
  eventType: z.enum(["product", "marketing", "system"]).default("product"),
  eventTime: z.string().optional(),
  sourceChannel: z.string().default("web"),
  payload: z.record(z.unknown()).default({}),
  pagePath: z.string().min(1).default("/"),
  consentSnapshot: consentSchema.optional()
});

export const telemetryLegacySchema = z.object({
  name: z.string().min(1),
  sessionId: z.string().optional(),
  payload: z.record(z.unknown()).default({})
});

export const telegramReminderRunSchema = z.object({
  kind: z.enum(["morning_plan", "evening_review"]).optional()
});

export const telegramOpsRunSchema = z.object({
  mode: z.enum(["cloud", "local_queue"]).optional(),
  chatId: z.number().int().optional()
});

export const assistantLocalJobEnqueueSchema = z.object({
  flowId: z.string().optional(),
  botId: z.enum([
    "tyler_durden",
    "zhuge_liang",
    "jensen_huang",
    "hemingway_ernest",
    "michael_corleone",
    "alfred_sentry"
  ]),
  chatId: z.number().int(),
  userId: z.number().int().optional(),
  threadId: z.string().optional(),
  mode: z.enum(["cloud_short", "local_heavy"]).default("local_heavy"),
  payload: z.record(z.unknown()).default({})
});

export const assistantLocalJobClaimSchema = z.object({
  workerId: z.string().min(1),
  flowId: z.string().optional()
});

export const assistantLocalJobCompleteSchema = z.object({
  jobId: z.string().min(1),
  status: z.enum(["done", "failed"]),
  outputText: z.string().optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
});

export const assistantActionReviewSchema = z.object({
  actionId: z.string().min(1),
  approvedBy: z.number().int().optional(),
  evidence: z.string().optional()
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type ConsentUpdateInput = z.infer<typeof consentUpdateSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PreviewInput = z.infer<typeof previewSchema>;
export type PaymentCreateInput = z.infer<typeof paymentCreateSchema>;
export type PaymentConfirmInput = z.infer<typeof paymentConfirmSchema>;
export type ShareCardInput = z.infer<typeof shareCardSchema>;
export type InviteCreateInput = z.infer<typeof inviteCreateSchema>;
export type InviteRedeemInput = z.infer<typeof inviteRedeemSchema>;
export type TelemetryV2Input = z.infer<typeof telemetryV2Schema>;
export type TelegramReminderRunInput = z.infer<typeof telegramReminderRunSchema>;
export type TelegramOpsRunInput = z.infer<typeof telegramOpsRunSchema>;
