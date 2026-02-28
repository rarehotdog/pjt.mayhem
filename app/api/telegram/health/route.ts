import { ensureSupabaseOrFail, fail, ok } from "@/lib/api";
import {
  getAssistantConfigSummary,
  getAssistantMissingConfigKeys,
  isAssistantConfigured
} from "@/lib/assistant-config";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

async function countRows(table: string) {
  const supabase = getSupabaseAdmin();
  const { count, error } = await supabase
    .from(table as never)
    .select("*", {
      count: "exact",
      head: true
    });
  if (error) {
    const message = error.message?.toLowerCase?.() ?? "";
    if (message.includes("does not exist") || message.includes("relation")) {
      return 0;
    }
    throw error;
  }
  return count ?? 0;
}

export async function GET() {
  const supabaseError = ensureSupabaseOrFail();
  if (supabaseError) {
    return supabaseError;
  }

  try {
    const configSummary = getAssistantConfigSummary();
    const missing = getAssistantMissingConfigKeys(undefined, {
      requireAllBots: true
    });
    const tables = {
      assistantUsers: await countRows("assistant_users"),
      assistantThreads: await countRows("assistant_threads"),
      assistantMessages: await countRows("assistant_messages"),
      assistantUpdates: await countRows("assistant_updates"),
      assistantReminderJobs: await countRows("assistant_reminder_jobs"),
      assistantLocalJobs: await countRows("assistant_local_jobs"),
      assistantActionApprovals: await countRows("assistant_action_approvals"),
      assistantCostLogs: await countRows("assistant_cost_logs")
    };

    return ok({
      ok: true,
      configured: isAssistantConfigured(undefined, {
        requireAllBots: true
      }),
      configuredPrimaryBot: isAssistantConfigured(undefined, {
        botId: "tyler_durden"
      }),
      missing,
      config: configSummary,
      tables,
      checkedAt: new Date().toISOString()
    });
  } catch (caught) {
    return fail("telegram health check failed", 500, {
      message: caught instanceof Error ? caught.message : String(caught)
    });
  }
}
