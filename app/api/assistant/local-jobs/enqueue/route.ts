import { NextRequest } from "next/server";

import { ensureSupabaseOrFail, fail, ok } from "@/lib/api";
import { normalizeAssistantBotId } from "@/lib/assistant-bots";
import { isWorkerAuthorized } from "@/lib/assistant-cron";
import { enqueueAssistantLocalJob } from "@/lib/assistant-store";
import { assistantLocalJobEnqueueSchema } from "@/lib/validators";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabaseError = ensureSupabaseOrFail();
  if (supabaseError) {
    return supabaseError;
  }

  if (!isWorkerAuthorized(request)) {
    return fail("unauthorized", 401);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = assistantLocalJobEnqueueSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid enqueue payload", 400, parsed.error.flatten());
  }

  try {
    const job = await enqueueAssistantLocalJob({
      flowId: parsed.data.flowId,
      botId: normalizeAssistantBotId(parsed.data.botId),
      chatId: parsed.data.chatId,
      userId: parsed.data.userId,
      threadId: parsed.data.threadId,
      mode: parsed.data.mode,
      payload: parsed.data.payload
    });

    return ok({
      ok: true,
      job
    });
  } catch (caught) {
    return fail("local job enqueue failed", 500, {
      message:
        caught instanceof Error
          ? caught.message
          : (() => {
              try {
                return JSON.stringify(caught);
              } catch {
                return String(caught);
              }
            })()
    });
  }
}
