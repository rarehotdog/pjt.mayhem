import { NextRequest } from "next/server";

import { getAssistantMissingConfigKeys, isAssistantConfigured } from "@/lib/assistant-config";
import { isCronAuthorized } from "@/lib/assistant-cron";
import { ensureSupabaseOrFail, fail, ok } from "@/lib/api";
import { resolveReminderKindFromRequest, runReminderBatch } from "@/lib/assistant-service";
import { telegramReminderRunSchema } from "@/lib/validators";

export const runtime = "nodejs";

async function handleRun(request: NextRequest, source: string) {
  const supabaseError = ensureSupabaseOrFail();
  if (supabaseError) {
    return supabaseError;
  }

  const botId = "tyler_durden";
  if (!isAssistantConfigured(undefined, { botId })) {
    return fail("assistant config missing", 503, {
      missing: getAssistantMissingConfigKeys(undefined, { botId })
    });
  }

  if (!isCronAuthorized(request)) {
    return fail("unauthorized", 401);
  }

  const body = request.method === "GET" ? {} : await request.json().catch(() => ({}));
  const parsed = telegramReminderRunSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid reminder run payload", 400, parsed.error.flatten());
  }

  const queryKind = request.nextUrl.searchParams.get("kind");
  const kind = resolveReminderKindFromRequest({
    queryKind,
    bodyKind: parsed.data.kind
  });

  try {
    const result = await runReminderBatch({
      botId,
      kind,
      source
    });
    return ok({
      ok: true,
      result
    });
  } catch (caught) {
    return fail("reminder batch failed", 500, {
      message: caught instanceof Error ? caught.message : String(caught)
    });
  }
}

export async function GET(request: NextRequest) {
  return handleRun(request, "reminder_endpoint_get");
}

export async function POST(request: NextRequest) {
  return handleRun(request, "reminder_endpoint_post");
}
