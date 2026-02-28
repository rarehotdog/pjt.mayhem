import { NextRequest } from "next/server";

import { ensureSupabaseOrFail, fail, ok } from "@/lib/api";
import { isWorkerAuthorized } from "@/lib/assistant-cron";
import { getAssistantActionApproval, updateAssistantActionApprovalStatus } from "@/lib/assistant-store";
import { assistantActionReviewSchema } from "@/lib/validators";

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
  const parsed = assistantActionReviewSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid approve payload", 400, parsed.error.flatten());
  }

  try {
    const existing = await getAssistantActionApproval(parsed.data.actionId);
    if (!existing) {
      return fail("action not found", 404, {
        actionId: parsed.data.actionId
      });
    }

    const updated = await updateAssistantActionApprovalStatus({
      actionId: parsed.data.actionId,
      status: "approved",
      approvedBy: parsed.data.approvedBy,
      evidence: parsed.data.evidence
    });

    return ok({
      ok: true,
      action: updated
    });
  } catch (caught) {
    return fail("action approve failed", 500, {
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
