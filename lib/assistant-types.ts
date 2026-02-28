export type AssistantRole = "system" | "user" | "assistant";
export type AssistantProviderName = "openai" | "anthropic" | "none";
export type AssistantUpdateSource = "webhook" | "polling" | "manual";
export type AssistantDispatchMode = "cloud" | "local_queue";
export type AssistantExecutionMode = "cloud_short" | "local_heavy";
export type AssistantBotId =
  | "tyler_durden"
  | "zhuge_liang"
  | "jensen_huang"
  | "hemingway_ernest"
  | "alfred_sentry";

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: "private" | "group" | "supergroup" | "channel";
  username?: string;
  first_name?: string;
  title?: string;
}

export interface TelegramMessage {
  message_id: number;
  date: number;
  text?: string;
  from?: TelegramUser;
  chat: TelegramChat;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
}

export interface AssistantRequestContext {
  botId: AssistantBotId;
  updateId: number;
  chatId: number;
  userId: number;
  messageId: number;
  threadId: string;
  text: string;
  source: AssistantUpdateSource;
  username?: string;
  firstName?: string;
  languageCode?: string;
}

export interface AssistantHistoryMessage {
  role: Exclude<AssistantRole, "system">;
  content: string;
  createdAt: string;
  provider?: AssistantProviderName;
  model?: string;
}

export interface AssistantProviderResult {
  provider: AssistantProviderName;
  model: string;
  outputText: string;
  latencyMs: number;
  tokensIn?: number;
  tokensOut?: number;
  estimatedCostUsd?: number;
  fallbackFrom?: AssistantProviderName;
  error?: string;
}

export type ReminderJobKind = "morning_plan" | "evening_review";
export type ReminderJobStatus = "pending" | "sent" | "failed" | "skipped";
export type AssistantLocalJobStatus = "queued" | "claimed" | "done" | "failed";
export type AssistantActionStatus = "draft" | "pending" | "approved" | "rejected" | "executed";

export type OpsFlowId =
  | "market_3h"
  | "gmat_mba_daily"
  | "finance_event_daily"
  | "world_knowledge_daily"
  | "hv_cycle_5d"
  | "product_wbs_daily"
  | "cost_guard_daily"
  | "agent_retrospective_weekly";

export interface ReminderJobPayload {
  jobId: string;
  userId: number;
  chatId: number;
  kind: ReminderJobKind;
  scheduleDate: string;
  scheduledFor: string;
  timezone: string;
  attempts: number;
}

export interface AssistantUserRecord {
  userId: number;
  chatId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
  timezone: string;
  remindersPaused: boolean;
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string;
}

export interface AssistantThreadRecord {
  botId: AssistantBotId;
  threadId: string;
  userId: number;
  chatId: number;
  summary?: string;
  locale?: string;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantMessageRecord {
  botId: AssistantBotId;
  messageId: string;
  threadId: string;
  telegramUpdateId?: number;
  role: AssistantRole;
  content: string;
  provider: AssistantProviderName;
  model?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface AssistantUpdateRecord {
  botId: AssistantBotId;
  updateId: number;
  userId?: number;
  chatId?: number;
  source: AssistantUpdateSource;
  status: string;
  error?: string;
  createdAt: string;
  processedAt?: string;
}

export interface AssistantReminderJobRecord {
  botId: AssistantBotId;
  jobId: string;
  userId: number;
  chatId: number;
  kind: ReminderJobKind;
  scheduleDate: string;
  scheduledFor: string;
  timezone: string;
  status: ReminderJobStatus;
  attemptCount: number;
  lastError?: string;
  sentAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantLocalJob {
  jobId: string;
  flowId?: OpsFlowId;
  botId: AssistantBotId;
  chatId: number;
  userId?: number;
  threadId?: string;
  mode: AssistantExecutionMode;
  payload: Record<string, unknown>;
  status: AssistantLocalJobStatus;
  claimedBy?: string;
  attemptCount: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface AssistantActionApproval {
  actionId: string;
  requestedByBot: AssistantBotId;
  actionType: string;
  payload: Record<string, unknown>;
  status: AssistantActionStatus;
  approvedBy?: number;
  approvedAt?: string;
  evidence?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssistantCostSnapshot {
  botId: AssistantBotId;
  provider: AssistantProviderName;
  model?: string;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  path: string;
  createdAt: string;
}
