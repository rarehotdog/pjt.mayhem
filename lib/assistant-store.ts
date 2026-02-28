/* eslint-disable @typescript-eslint/no-explicit-any */

import { nanoid } from "nanoid";

import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  AssistantActionApproval,
  AssistantActionStatus,
  AssistantBotId,
  AssistantCostSnapshot,
  AssistantExecutionMode,
  AssistantHistoryMessage,
  AssistantLocalJob,
  AssistantLocalJobStatus,
  AssistantMessageRecord,
  AssistantProviderName,
  AssistantRole,
  AssistantThreadRecord,
  AssistantUpdateRecord,
  AssistantUpdateSource,
  AssistantUserRecord,
  ReminderJobKind,
  ReminderJobStatus
} from "@/lib/assistant-types";

function asRecord(row: unknown): Record<string, unknown> {
  return (row as Record<string, unknown>) ?? {};
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function toAssistantUser(row: unknown): AssistantUserRecord {
  const record = asRecord(row);
  return {
    userId: Number(record.user_id),
    chatId: Number(record.chat_id),
    username: toOptionalString(record.username),
    firstName: toOptionalString(record.first_name),
    languageCode: toOptionalString(record.language_code),
    timezone: toOptionalString(record.timezone) ?? "Asia/Seoul",
    remindersPaused: Boolean(record.reminders_paused),
    createdAt: String(record.created_at),
    updatedAt: String(record.updated_at),
    lastSeenAt: String(record.last_seen_at)
  };
}

function toAssistantThread(row: unknown): AssistantThreadRecord {
  const record = asRecord(row);
  return {
    botId: (toOptionalString(record.bot_id) ?? "tyler_durden") as AssistantBotId,
    threadId: String(record.thread_id),
    userId: Number(record.user_id),
    chatId: Number(record.chat_id),
    summary: toOptionalString(record.summary),
    locale: toOptionalString(record.locale),
    lastMessageAt: String(record.last_message_at),
    createdAt: String(record.created_at),
    updatedAt: String(record.updated_at)
  };
}

function toAssistantMessage(row: unknown): AssistantMessageRecord {
  const record = asRecord(row);
  return {
    botId: (toOptionalString(record.bot_id) ?? "tyler_durden") as AssistantBotId,
    messageId: String(record.message_id),
    threadId: String(record.thread_id),
    telegramUpdateId:
      typeof record.telegram_update_id === "number" ? Number(record.telegram_update_id) : undefined,
    role: String(record.role) as AssistantRole,
    content: String(record.content ?? ""),
    provider: (toOptionalString(record.provider) ?? "none") as AssistantProviderName,
    model: toOptionalString(record.model),
    metadata:
      typeof record.metadata === "object" && record.metadata !== null
        ? (record.metadata as Record<string, unknown>)
        : {},
    createdAt: String(record.created_at)
  };
}

function toAssistantUpdate(row: unknown): AssistantUpdateRecord {
  const record = asRecord(row);
  return {
    botId: (toOptionalString(record.bot_id) ?? "tyler_durden") as AssistantBotId,
    updateId: Number(record.update_id),
    userId: typeof record.user_id === "number" ? Number(record.user_id) : undefined,
    chatId: typeof record.chat_id === "number" ? Number(record.chat_id) : undefined,
    source: (toOptionalString(record.source) ?? "webhook") as AssistantUpdateSource,
    status: String(record.status ?? "received"),
    error: toOptionalString(record.error),
    createdAt: String(record.created_at),
    processedAt: toOptionalString(record.processed_at)
  };
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

function toReminderJob(row: unknown): AssistantReminderJobRecord {
  const record = asRecord(row);
  return {
    botId: (toOptionalString(record.bot_id) ?? "tyler_durden") as AssistantBotId,
    jobId: String(record.job_id),
    userId: Number(record.user_id),
    chatId: Number(record.chat_id),
    kind: String(record.kind) as ReminderJobKind,
    scheduleDate: String(record.schedule_date),
    scheduledFor: String(record.scheduled_for),
    timezone: String(record.timezone),
    status: String(record.status) as ReminderJobStatus,
    attemptCount: Number(record.attempt_count ?? 0),
    lastError: toOptionalString(record.last_error),
    sentAt: toOptionalString(record.sent_at),
    createdAt: String(record.created_at),
    updatedAt: String(record.updated_at)
  };
}

function toAssistantLocalJob(row: unknown): AssistantLocalJob {
  const record = asRecord(row);
  return {
    jobId: String(record.job_id),
    flowId: toOptionalString(record.flow_id) as AssistantLocalJob["flowId"],
    botId: (toOptionalString(record.bot_id) ?? "tyler_durden") as AssistantBotId,
    chatId: Number(record.chat_id),
    userId: typeof record.user_id === "number" ? Number(record.user_id) : undefined,
    threadId: toOptionalString(record.thread_id),
    mode: (toOptionalString(record.mode) ?? "local_heavy") as AssistantExecutionMode,
    payload:
      typeof record.payload === "object" && record.payload !== null
        ? (record.payload as Record<string, unknown>)
        : {},
    status: (toOptionalString(record.status) ?? "queued") as AssistantLocalJobStatus,
    claimedBy: toOptionalString(record.claimed_by),
    attemptCount: Number(record.attempt_count ?? 0),
    error: toOptionalString(record.error),
    createdAt: String(record.created_at),
    updatedAt: String(record.updated_at),
    completedAt: toOptionalString(record.completed_at)
  };
}

function toAssistantActionApproval(row: unknown): AssistantActionApproval {
  const record = asRecord(row);
  return {
    actionId: String(record.action_id),
    requestedByBot: (toOptionalString(record.requested_by_bot) ?? "tyler_durden") as AssistantBotId,
    actionType: String(record.action_type ?? "generic"),
    payload:
      typeof record.payload === "object" && record.payload !== null
        ? (record.payload as Record<string, unknown>)
        : {},
    status: (toOptionalString(record.status) ?? "pending") as AssistantActionStatus,
    approvedBy: typeof record.approved_by === "number" ? Number(record.approved_by) : undefined,
    approvedAt: toOptionalString(record.approved_at),
    evidence: toOptionalString(record.evidence),
    createdAt: String(record.created_at),
    updatedAt: String(record.updated_at)
  };
}

function getNowIso() {
  return new Date().toISOString();
}

export async function getAssistantUser(userId: number): Promise<AssistantUserRecord | null> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("assistant_users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return toAssistantUser(data);
}

interface UpsertAssistantUserInput {
  userId: number;
  chatId: number;
  username?: string;
  firstName?: string;
  languageCode?: string;
  timezone: string;
}

export async function upsertAssistantUser(
  input: UpsertAssistantUserInput
): Promise<AssistantUserRecord> {
  const now = getNowIso();
  const existing = await getAssistantUser(input.userId);
  const supabase = getSupabaseAdmin() as any;

  if (existing) {
    const payload = {
      chat_id: input.chatId,
      username: input.username ?? null,
      first_name: input.firstName ?? null,
      language_code: input.languageCode ?? null,
      timezone: input.timezone,
      updated_at: now,
      last_seen_at: now
    };

    const { data, error } = await supabase
      .from("assistant_users")
      .update(payload)
      .eq("user_id", input.userId)
      .select("*")
      .single();
    if (error) {
      throw error;
    }

    return toAssistantUser(data);
  }

  const payload = {
    user_id: input.userId,
    chat_id: input.chatId,
    username: input.username ?? null,
    first_name: input.firstName ?? null,
    language_code: input.languageCode ?? null,
    timezone: input.timezone,
    reminders_paused: false,
    created_at: now,
    updated_at: now,
    last_seen_at: now
  };

  const { data, error } = await supabase.from("assistant_users").insert(payload).select("*").single();
  if (error) {
    throw error;
  }

  return toAssistantUser(data);
}

export async function setAssistantReminderPaused(userId: number, paused: boolean) {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();

  const { data, error } = await supabase
    .from("assistant_users")
    .update({
      reminders_paused: paused,
      updated_at: now
    })
    .eq("user_id", userId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return toAssistantUser(data);
}

interface TouchThreadInput {
  botId?: AssistantBotId;
  threadId: string;
  userId: number;
  chatId: number;
  locale?: string;
}

export async function touchAssistantThread(input: TouchThreadInput): Promise<AssistantThreadRecord> {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();
  const botId = input.botId ?? "tyler_durden";

  const { data: existing, error: existingError } = await supabase
    .from("assistant_threads")
    .select("*")
    .eq("thread_id", input.threadId)
    .eq("bot_id", botId)
    .maybeSingle();
  if (existingError) {
    throw existingError;
  }

  if (existing) {
    const { data, error } = await supabase
      .from("assistant_threads")
      .update({
        bot_id: botId,
        user_id: input.userId,
        chat_id: input.chatId,
        locale: input.locale ?? existing.locale ?? null,
        last_message_at: now,
        updated_at: now
      })
      .eq("thread_id", input.threadId)
      .select("*")
      .single();
    if (error) {
      throw error;
    }
    return toAssistantThread(data);
  }

  const { data, error } = await supabase
    .from("assistant_threads")
    .insert({
      bot_id: botId,
      thread_id: input.threadId,
      user_id: input.userId,
      chat_id: input.chatId,
      locale: input.locale ?? null,
      summary: null,
      last_message_at: now,
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return toAssistantThread(data);
}

export async function updateThreadSummary(threadId: string, summary: string) {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();
  const { error } = await supabase
    .from("assistant_threads")
    .update({
      summary,
      updated_at: now
    })
    .eq("thread_id", threadId);

  if (error) {
    throw error;
  }
}

interface AppendMessageInput {
  botId?: AssistantBotId;
  threadId: string;
  role: AssistantRole;
  content: string;
  provider: AssistantProviderName;
  model?: string;
  telegramUpdateId?: number;
  metadata?: Record<string, unknown>;
}

export async function appendAssistantMessage(input: AppendMessageInput): Promise<AssistantMessageRecord> {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();
  const botId = input.botId ?? "tyler_durden";
  const { data, error } = await supabase
    .from("assistant_messages")
    .insert({
      bot_id: botId,
      message_id: nanoid(16),
      thread_id: input.threadId,
      telegram_update_id: input.telegramUpdateId ?? null,
      role: input.role,
      content: input.content,
      provider: input.provider,
      model: input.model ?? null,
      metadata: input.metadata ?? {},
      created_at: now
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }

  return toAssistantMessage(data);
}

export async function listRecentAssistantMessages(
  threadId: string,
  limit = 20,
  botId: AssistantBotId = "tyler_durden"
): Promise<AssistantHistoryMessage[]> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("assistant_messages")
    .select("*")
    .eq("bot_id", botId)
    .eq("thread_id", threadId)
    .in("role", ["user", "assistant"])
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const rows: AssistantMessageRecord[] = ((data ?? []) as unknown[]).map((row: unknown) =>
    toAssistantMessage(row)
  );

  return rows
    .reverse()
    .map((row) => ({ role: row.role as "user" | "assistant", content: row.content, createdAt: row.createdAt }));
}

export async function listReminderTargets(): Promise<AssistantUserRecord[]> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("assistant_users")
    .select("*")
    .eq("reminders_paused", false);
  if (error) {
    throw error;
  }
  return ((data ?? []) as unknown[]).map((row: unknown) => toAssistantUser(row));
}

interface CreateReminderJobInput {
  botId?: AssistantBotId;
  userId: number;
  chatId: number;
  kind: ReminderJobKind;
  scheduleDate: string;
  timezone: string;
  scheduledFor: string;
}

export async function createReminderJobIfNotExists(input: CreateReminderJobInput): Promise<{
  created: boolean;
  job: AssistantReminderJobRecord;
}> {
  const supabase = getSupabaseAdmin() as any;
  const botId = input.botId ?? "tyler_durden";
  const existingQuery = await supabase
    .from("assistant_reminder_jobs")
    .select("*")
    .eq("bot_id", botId)
    .eq("user_id", input.userId)
    .eq("kind", input.kind)
    .eq("schedule_date", input.scheduleDate)
    .maybeSingle();
  if (existingQuery.error) {
    throw existingQuery.error;
  }

  if (existingQuery.data) {
    return {
      created: false,
      job: toReminderJob(existingQuery.data)
    };
  }

  const now = getNowIso();
  const { data, error } = await supabase
    .from("assistant_reminder_jobs")
    .insert({
      bot_id: botId,
      job_id: nanoid(14),
      user_id: input.userId,
      chat_id: input.chatId,
      kind: input.kind,
      schedule_date: input.scheduleDate,
      scheduled_for: input.scheduledFor,
      timezone: input.timezone,
      status: "pending",
      attempt_count: 0,
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return {
    created: true,
    job: toReminderJob(data)
  };
}

export async function markReminderJobStatus(
  jobId: string,
  status: ReminderJobStatus,
  options?: { lastError?: string; sentAt?: string; incrementAttempt?: boolean }
) {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();

  const currentQuery = await supabase
    .from("assistant_reminder_jobs")
    .select("attempt_count")
    .eq("job_id", jobId)
    .single();
  if (currentQuery.error) {
    throw currentQuery.error;
  }

  const currentAttempt = Number(currentQuery.data?.attempt_count ?? 0);
  const nextAttempt = options?.incrementAttempt ? currentAttempt + 1 : currentAttempt;

  const { error } = await supabase
    .from("assistant_reminder_jobs")
    .update({
      status,
      attempt_count: nextAttempt,
      last_error: options?.lastError ?? null,
      sent_at: options?.sentAt ?? null,
      updated_at: now
    })
    .eq("job_id", jobId);
  if (error) {
    throw error;
  }
}

interface EnqueueAssistantLocalJobInput {
  flowId?: string;
  botId: AssistantBotId;
  chatId: number;
  userId?: number;
  threadId?: string;
  mode: AssistantExecutionMode;
  payload: Record<string, unknown>;
}

export async function enqueueAssistantLocalJob(
  input: EnqueueAssistantLocalJobInput
): Promise<AssistantLocalJob> {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();
  const { data, error } = await supabase
    .from("assistant_local_jobs")
    .insert({
      job_id: nanoid(18),
      flow_id: input.flowId ?? null,
      bot_id: input.botId,
      chat_id: input.chatId,
      user_id: input.userId ?? null,
      thread_id: input.threadId ?? null,
      mode: input.mode,
      payload: input.payload,
      status: "queued",
      claimed_by: null,
      attempt_count: 0,
      error: null,
      completed_at: null,
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return toAssistantLocalJob(data);
}

export async function claimAssistantLocalJob(options: {
  workerId: string;
  flowId?: string;
}): Promise<AssistantLocalJob | null> {
  const supabase = getSupabaseAdmin() as any;
  let query = supabase
    .from("assistant_local_jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(1);

  if (options.flowId) {
    query = query.eq("flow_id", options.flowId);
  }

  const { data: queued, error: queueError } = await query.maybeSingle();
  if (queueError) {
    throw queueError;
  }
  if (!queued) {
    return null;
  }

  const now = getNowIso();
  const nextAttempt = Number(queued.attempt_count ?? 0) + 1;
  const { data: claimed, error: claimError } = await supabase
    .from("assistant_local_jobs")
    .update({
      status: "claimed",
      claimed_by: options.workerId,
      attempt_count: nextAttempt,
      updated_at: now
    })
    .eq("job_id", queued.job_id)
    .eq("status", "queued")
    .select("*")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }
  if (!claimed) {
    return null;
  }
  return toAssistantLocalJob(claimed);
}

export async function completeAssistantLocalJob(
  jobId: string,
  options?: {
    error?: string;
  }
) {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();
  const status: AssistantLocalJobStatus = options?.error ? "failed" : "done";

  const { data, error } = await supabase
    .from("assistant_local_jobs")
    .update({
      status,
      error: options?.error ?? null,
      completed_at: now,
      updated_at: now
    })
    .eq("job_id", jobId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }
  return toAssistantLocalJob(data);
}

interface CreateAssistantActionApprovalInput {
  requestedByBot: AssistantBotId;
  actionType: string;
  payload: Record<string, unknown>;
  status?: AssistantActionStatus;
}

export async function createAssistantActionApproval(
  input: CreateAssistantActionApprovalInput
): Promise<AssistantActionApproval> {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();
  const { data, error } = await supabase
    .from("assistant_action_approvals")
    .insert({
      action_id: nanoid(16),
      requested_by_bot: input.requestedByBot,
      action_type: input.actionType,
      payload: input.payload,
      status: input.status ?? "pending",
      approved_by: null,
      approved_at: null,
      evidence: null,
      created_at: now,
      updated_at: now
    })
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return toAssistantActionApproval(data);
}

export async function getAssistantActionApproval(
  actionId: string
): Promise<AssistantActionApproval | null> {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("assistant_action_approvals")
    .select("*")
    .eq("action_id", actionId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  return data ? toAssistantActionApproval(data) : null;
}

export async function updateAssistantActionApprovalStatus(input: {
  actionId: string;
  status: Extract<AssistantActionStatus, "approved" | "rejected" | "executed">;
  approvedBy?: number;
  evidence?: string;
}): Promise<AssistantActionApproval> {
  const supabase = getSupabaseAdmin() as any;
  const now = getNowIso();

  const payload: Record<string, unknown> = {
    status: input.status,
    updated_at: now
  };

  if (input.status === "approved" || input.status === "executed") {
    payload.approved_by = input.approvedBy ?? null;
    payload.approved_at = now;
  }

  if (typeof input.evidence === "string") {
    payload.evidence = input.evidence;
  }

  const { data, error } = await supabase
    .from("assistant_action_approvals")
    .update(payload)
    .eq("action_id", input.actionId)
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return toAssistantActionApproval(data);
}

export async function appendAssistantCostLog(input: {
  botId: AssistantBotId;
  provider: AssistantProviderName;
  model?: string;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
  path: string;
}) {
  const supabase = getSupabaseAdmin() as any;
  const { error } = await supabase.from("assistant_cost_logs").insert({
    bot_id: input.botId,
    provider: input.provider,
    model: input.model ?? null,
    tokens_in: input.tokensIn,
    tokens_out: input.tokensOut,
    estimated_cost: input.estimatedCostUsd,
    path: input.path,
    created_at: getNowIso()
  });

  if (error) {
    throw error;
  }
}

export async function summarizeAssistantCostsLast24h(reference = new Date()) {
  const supabase = getSupabaseAdmin() as any;
  const from = new Date(reference.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("assistant_cost_logs")
    .select("*")
    .gte("created_at", from)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }

  const rows = ((data ?? []) as unknown[]).map((row): AssistantCostSnapshot => {
    const record = asRecord(row);
    return {
      botId: (toOptionalString(record.bot_id) ?? "tyler_durden") as AssistantBotId,
      provider: (toOptionalString(record.provider) ?? "none") as AssistantProviderName,
      model: toOptionalString(record.model),
      tokensIn: Number(record.tokens_in ?? 0),
      tokensOut: Number(record.tokens_out ?? 0),
      estimatedCostUsd: Number(record.estimated_cost ?? 0),
      path: toOptionalString(record.path) ?? "unknown",
      createdAt: String(record.created_at)
    };
  });

  const byBot = new Map<AssistantBotId, { tokens: number; cost: number; calls: number }>();
  let totalTokens = 0;
  let totalCost = 0;

  for (const row of rows) {
    const tokens = row.tokensIn + row.tokensOut;
    totalTokens += tokens;
    totalCost += row.estimatedCostUsd;

    const current = byBot.get(row.botId) ?? {
      tokens: 0,
      cost: 0,
      calls: 0
    };

    byBot.set(row.botId, {
      tokens: current.tokens + tokens,
      cost: current.cost + row.estimatedCostUsd,
      calls: current.calls + 1
    });
  }

  return {
    from,
    totalTokens,
    totalCostUsd: Number(totalCost.toFixed(6)),
    calls: rows.length,
    byBot: Array.from(byBot.entries()).map(([botId, entry]) => ({
      botId,
      tokens: entry.tokens,
      costUsd: Number(entry.cost.toFixed(6)),
      calls: entry.calls
    }))
  };
}

export interface InsertAssistantUpdateInput {
  botId?: AssistantBotId;
  updateId: number;
  userId?: number;
  chatId?: number;
  source: AssistantUpdateSource;
  status?: string;
  error?: string;
}

export interface AssistantUpdateRepository {
  findById(updateId: number, botId?: AssistantBotId): Promise<AssistantUpdateRecord | null>;
  insert(input: InsertAssistantUpdateInput): Promise<AssistantUpdateRecord>;
  markStatus(updateId: number, status: string, error?: string, botId?: AssistantBotId): Promise<void>;
}

export function createSupabaseAssistantUpdateRepository(): AssistantUpdateRepository {
  return {
    async findById(updateId: number, botId: AssistantBotId = "tyler_durden") {
      const supabase = getSupabaseAdmin() as any;
      const { data, error } = await supabase
        .from("assistant_updates")
        .select("*")
        .eq("bot_id", botId)
        .eq("update_id", updateId)
        .maybeSingle();
      if (error) {
        throw error;
      }
      return data ? toAssistantUpdate(data) : null;
    },
    async insert(input: InsertAssistantUpdateInput) {
      const supabase = getSupabaseAdmin() as any;
      const now = getNowIso();
      const { data, error } = await supabase
        .from("assistant_updates")
        .insert({
          bot_id: input.botId ?? "tyler_durden",
          update_id: input.updateId,
          user_id: input.userId ?? null,
          chat_id: input.chatId ?? null,
          source: input.source,
          status: input.status ?? "received",
          error: input.error ?? null,
          created_at: now,
          processed_at: null
        })
        .select("*")
        .single();
      if (error) {
        throw error;
      }
      return toAssistantUpdate(data);
    },
    async markStatus(
      updateId: number,
      status: string,
      error?: string,
      botId: AssistantBotId = "tyler_durden"
    ) {
      const supabase = getSupabaseAdmin() as any;
      const payload = {
        status,
        error: error ?? null,
        processed_at: getNowIso()
      };
      const { error: updateError } = await supabase
        .from("assistant_updates")
        .update(payload)
        .eq("bot_id", botId)
        .eq("update_id", updateId);
      if (updateError) {
        throw updateError;
      }
    }
  };
}

export async function reserveAssistantUpdate(
  input: InsertAssistantUpdateInput,
  repository: AssistantUpdateRepository = createSupabaseAssistantUpdateRepository()
): Promise<{ reserved: boolean; record: AssistantUpdateRecord }> {
  const botId = input.botId ?? "tyler_durden";
  const existing = await repository.findById(input.updateId, botId);
  if (existing) {
    return { reserved: false, record: existing };
  }

  const inserted = await repository.insert({
    ...input,
    botId
  });
  return { reserved: true, record: inserted };
}

export async function markAssistantUpdateStatus(
  updateId: number,
  status: string,
  error?: string,
  botId: AssistantBotId = "tyler_durden",
  repository: AssistantUpdateRepository = createSupabaseAssistantUpdateRepository()
) {
  await repository.markStatus(updateId, status, error, botId);
}

export function createInMemoryAssistantUpdateRepository(
  seed: AssistantUpdateRecord[] = []
): AssistantUpdateRepository {
  const map = new Map<string, AssistantUpdateRecord>();
  for (const row of seed) {
    map.set(`${row.botId}:${row.updateId}`, row);
  }

  return {
    async findById(updateId: number, botId: AssistantBotId = "tyler_durden") {
      return map.get(`${botId}:${updateId}`) ?? null;
    },
    async insert(input: InsertAssistantUpdateInput) {
      const now = getNowIso();
      const botId = input.botId ?? "tyler_durden";
      const row: AssistantUpdateRecord = {
        botId,
        updateId: input.updateId,
        userId: input.userId,
        chatId: input.chatId,
        source: input.source,
        status: input.status ?? "received",
        error: input.error,
        createdAt: now
      };
      map.set(`${botId}:${input.updateId}`, row);
      return row;
    },
    async markStatus(
      updateId: number,
      status: string,
      error?: string,
      botId: AssistantBotId = "tyler_durden"
    ) {
      const key = `${botId}:${updateId}`;
      const current = map.get(key);
      if (!current) {
        return;
      }
      map.set(key, {
        ...current,
        status,
        error,
        processedAt: getNowIso()
      });
    }
  };
}
