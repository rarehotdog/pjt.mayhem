import { NextRequest } from "next/server";

import { getAssistantMissingConfigKeys, isAssistantConfigured } from "@/lib/assistant-config";
import { isCronAuthorized } from "@/lib/assistant-cron";
import { isOpsFlowId, runOpsFlow } from "@/lib/assistant-ops";
import { fail, ok } from "@/lib/api";
import { telegramOpsRunSchema } from "@/lib/validators";

export const runtime = "nodejs";

async function handleRun(
  request: NextRequest,
  context: {
    params: {
      flow: string;
    };
  },
  source: string
) {
  const { flow } = context.params;
  if (!isOpsFlowId(flow)) {
    return fail("invalid ops flow", 404, {
      flow
    });
  }

  if (!isAssistantConfigured(undefined, { requireAllBots: true })) {
    return fail("assistant config missing", 503, {
      missing: getAssistantMissingConfigKeys(undefined, { requireAllBots: true })
    });
  }

  if (!isCronAuthorized(request)) {
    return fail("unauthorized", 401);
  }

  const body = await request.json().catch(() => ({}));
  const parsed = telegramOpsRunSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid ops run payload", 400, parsed.error.flatten());
  }

  try {
    const result = await runOpsFlow({
      flow,
      chatId: parsed.data.chatId,
      mode: parsed.data.mode,
      source
    });

    return ok({
      ok: true,
      result
    });
  } catch (caught) {
    return fail("ops flow failed", 500, {
      message: caught instanceof Error ? caught.message : String(caught),
      flow
    });
  }
}

export async function GET(
  request: NextRequest,
  context: {
    params: {
      flow: string;
    };
  }
) {
  return handleRun(request, context, "ops_endpoint_get");
}

export async function POST(
  request: NextRequest,
  context: {
    params: {
      flow: string;
    };
  }
) {
  return handleRun(request, context, "ops_endpoint_post");
}
