import { NextRequest } from "next/server";

import { isAssistantBotId, normalizeAssistantBotId } from "@/lib/assistant-bots";
import {
  getAssistantMissingConfigKeys,
  isAssistantConfigured,
  isWebhookSecretValid
} from "@/lib/assistant-config";
import { ensureSupabaseOrFail, fail, ok } from "@/lib/api";
import { processTelegramUpdate } from "@/lib/assistant-service";
import type { AssistantBotId, TelegramUpdate } from "@/lib/assistant-types";

export const runtime = "nodejs";

function isTelegramUpdatePayload(payload: unknown): payload is TelegramUpdate {
  return (
    typeof payload === "object" &&
    payload !== null &&
    typeof (payload as { update_id?: unknown }).update_id === "number"
  );
}

export async function POST(
  request: NextRequest,
  context: { params: { botId: string } }
) {
  const supabaseError = ensureSupabaseOrFail();
  if (supabaseError) {
    return supabaseError;
  }

  const { botId: rawBotId } = context.params;
  if (!isAssistantBotId(rawBotId)) {
    return fail("unknown bot_id", 404, {
      botId: rawBotId
    });
  }
  const botId = normalizeAssistantBotId(rawBotId) as AssistantBotId;

  if (!isAssistantConfigured(undefined, { botId })) {
    return fail("assistant config missing", 503, {
      missing: getAssistantMissingConfigKeys(undefined, { botId })
    });
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!isWebhookSecretValid(secretHeader, botId)) {
    return fail("forbidden", 403);
  }

  const payload = await request.json().catch(() => null);
  if (!isTelegramUpdatePayload(payload)) {
    return fail("invalid telegram update payload", 400);
  }

  try {
    const result = await processTelegramUpdate(payload, "webhook", botId);
    return ok({
      ok: true,
      requestedBotId: rawBotId,
      botId,
      result
    });
  } catch (caught) {
    const message =
      caught instanceof Error
        ? caught.message
        : (() => {
            try {
              return JSON.stringify(caught);
            } catch {
              return String(caught);
            }
          })();
    return fail("telegram webhook processing failed", 500, {
      requestedBotId: rawBotId,
      botId,
      message
    });
  }
}
