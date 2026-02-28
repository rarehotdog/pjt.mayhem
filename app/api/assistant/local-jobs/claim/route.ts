import { NextRequest } from "next/server";

import { ensureSupabaseOrFail, fail, ok } from "@/lib/api";
import { isWorkerAuthorized } from "@/lib/assistant-cron";
import { claimAssistantLocalJob } from "@/lib/assistant-store";
import { assistantLocalJobClaimSchema } from "@/lib/validators";

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
  const parsed = assistantLocalJobClaimSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid claim payload", 400, parsed.error.flatten());
  }

  try {
    const job = await claimAssistantLocalJob({
      workerId: parsed.data.workerId,
      flowId: parsed.data.flowId
    });

    return ok({
      ok: true,
      job
    });
  } catch (caught) {
    return fail("local job claim failed", 500, {
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
