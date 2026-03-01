import { getAssistantBotRuntimeConfig, getAssistantConfig } from "@/lib/assistant-config";
import type { AssistantBotId, TelegramUpdate } from "@/lib/assistant-types";

const TELEGRAM_API_BASE = "https://api.telegram.org";

interface TelegramApiResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

class TelegramApiError extends Error {
  status: number;
  payload: TelegramApiResponse<unknown>;

  constructor(method: string, status: number, payload: TelegramApiResponse<unknown>) {
    super(`Telegram API ${method} failed (${status}): ${payload.description ?? "unknown error"}`);
    this.name = "TelegramApiError";
    this.status = status;
    this.payload = payload;
  }
}

async function callTelegramApi<T>(
  method: string,
  payload: Record<string, unknown>,
  botId: AssistantBotId = "tyler_durden"
): Promise<T> {
  const config = getAssistantConfig();
  const runtime = getAssistantBotRuntimeConfig(botId, config);
  if (!runtime.token) {
    throw new Error(`${botId} token is not configured.`);
  }

  const endpoint = `${TELEGRAM_API_BASE}/bot${runtime.token}/${method}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const parsed = (await response.json().catch(() => ({}))) as TelegramApiResponse<T>;
  if (!response.ok || !parsed.ok || !parsed.result) {
    throw new TelegramApiError(method, response.status, parsed as TelegramApiResponse<unknown>);
  }

  return parsed.result;
}

export async function sendTelegramMessage(input: {
  botId?: AssistantBotId;
  chatId: number;
  text: string;
  replyToMessageId?: number;
  disableNotification?: boolean;
}) {
  const botId = input.botId ?? "tyler_durden";
  const basePayload = {
    text: input.text,
    reply_parameters: input.replyToMessageId
      ? {
          message_id: input.replyToMessageId,
          allow_sending_without_reply: true
        }
      : undefined,
    disable_notification: input.disableNotification ?? false
  };

  try {
    return await callTelegramApi<{ message_id: number }>(
      "sendMessage",
      {
        ...basePayload,
        chat_id: input.chatId
      },
      botId
    );
  } catch (caught) {
    if (
      caught instanceof TelegramApiError &&
      caught.payload.error_code === 400 &&
      typeof caught.payload.parameters?.migrate_to_chat_id === "number"
    ) {
      return callTelegramApi<{ message_id: number }>(
        "sendMessage",
        {
          ...basePayload,
          chat_id: caught.payload.parameters.migrate_to_chat_id
        },
        botId
      );
    }
    throw caught;
  }
}

export async function getTelegramUpdates(input?: {
  botId?: AssistantBotId;
  offset?: number;
  timeoutSeconds?: number;
  allowedUpdates?: string[];
}) {
  return callTelegramApi<TelegramUpdate[]>("getUpdates", {
    offset: input?.offset,
    timeout: input?.timeoutSeconds ?? 30,
    allowed_updates: input?.allowedUpdates ?? ["message"]
  }, input?.botId);
}

export async function setTelegramWebhook(
  url: string,
  secretToken: string,
  botId: AssistantBotId = "tyler_durden"
) {
  return callTelegramApi<boolean>("setWebhook", {
    url,
    secret_token: secretToken,
    allowed_updates: ["message"],
    drop_pending_updates: false
  }, botId);
}

export async function deleteTelegramWebhook(
  dropPendingUpdates = false,
  botId: AssistantBotId = "tyler_durden"
) {
  return callTelegramApi<boolean>("deleteWebhook", {
    drop_pending_updates: dropPendingUpdates
  }, botId);
}

export async function getTelegramWebhookInfo(botId: AssistantBotId = "tyler_durden") {
  return callTelegramApi<{
    url: string;
    has_custom_certificate: boolean;
    pending_update_count: number;
    last_error_date?: number;
    last_error_message?: string;
  }>("getWebhookInfo", {}, botId);
}
