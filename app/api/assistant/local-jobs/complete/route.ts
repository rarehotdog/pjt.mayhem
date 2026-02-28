import { NextRequest } from "next/server";

import { ensureSupabaseOrFail, fail, ok } from "@/lib/api";
import { isWorkerAuthorized } from "@/lib/assistant-cron";
import { generateAssistantReply } from "@/lib/assistant-llm";
import { isOpsFlowId, runOpsFlow } from "@/lib/assistant-ops";
import { appendAssistantCostLog, appendAssistantMessage, completeAssistantLocalJob } from "@/lib/assistant-store";
import { sendTelegramMessage } from "@/lib/telegram";
import { assistantLocalJobCompleteSchema } from "@/lib/validators";

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
  const parsed = assistantLocalJobCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return fail("invalid complete payload", 400, parsed.error.flatten());
  }

  try {
    const completedJob = await completeAssistantLocalJob(parsed.data.jobId, {
      error: parsed.data.status === "failed" ? parsed.data.error ?? "worker_failed" : undefined
    });

    const payload = completedJob.payload ?? {};
    const header = typeof payload.header === "string" ? payload.header : "";
    const skipSend = Boolean(parsed.data.metadata?.skipSend);
    const replyToMessageId =
      typeof payload.replyToMessageId === "number" ? payload.replyToMessageId : undefined;

    if (parsed.data.status === "done") {
      const outputText = parsed.data.outputText?.trim();
      if (!outputText) {
        return fail("outputText is required when status=done", 400);
      }

      const messageText = header ? `${header}\n\n${outputText}` : outputText;
      if (!skipSend) {
        await sendTelegramMessage({
          botId: completedJob.botId,
          chatId: completedJob.chatId,
          text: messageText,
          replyToMessageId
        });
      }

      if (completedJob.threadId) {
        await appendAssistantMessage({
          botId: completedJob.botId,
          threadId: completedJob.threadId,
          role: "assistant",
          content: messageText,
          provider: "none",
          model: "local-worker",
          metadata: {
            localJobId: completedJob.jobId,
            ...parsed.data.metadata
          }
        });
      }
    } else {
      const taskType = typeof payload.taskType === "string" ? payload.taskType : "unknown";
      if (taskType === "ops_flow" && typeof completedJob.flowId === "string" && isOpsFlowId(completedJob.flowId)) {
        await runOpsFlow({
          flow: completedJob.flowId,
          chatId: completedJob.chatId,
          mode: "cloud",
          source: "local_worker_fallback"
        });
      } else if (taskType === "chat_reply" && typeof payload.userText === "string") {
        const history = Array.isArray(payload.history)
          ? payload.history
              .filter((item): item is { role: "user" | "assistant"; content: string; createdAt: string } => {
                return Boolean(
                  item &&
                    typeof item === "object" &&
                    (item as { role?: unknown }).role &&
                    ((item as { role?: unknown }).role === "user" ||
                      (item as { role?: unknown }).role === "assistant") &&
                    typeof (item as { content?: unknown }).content === "string"
                );
              })
              .map((item) => ({
                role: item.role,
                content: item.content,
                createdAt:
                  typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString()
              }))
          : [];

        const fallback = await generateAssistantReply({
          botId: completedJob.botId,
          history,
          userText: payload.userText,
          timezone: typeof payload.timezone === "string" ? payload.timezone : "Asia/Seoul",
          maxOutputTokens: 220,
          temperature: 0.2
        });

        const messageText = `⚠️ 로컬 워커 실패로 클라우드 백업 응답으로 전환했습니다.\n\n${fallback.outputText}`;
        await sendTelegramMessage({
          botId: completedJob.botId,
          chatId: completedJob.chatId,
          text: messageText,
          replyToMessageId
        });

        await appendAssistantCostLog({
          botId: completedJob.botId,
          provider: fallback.provider,
          model: fallback.model,
          tokensIn: fallback.tokensIn ?? 0,
          tokensOut: fallback.tokensOut ?? 0,
          estimatedCostUsd: fallback.estimatedCostUsd ?? 0,
          path: "local_worker_fallback:chat"
        }).catch(() => undefined);
      } else {
        await sendTelegramMessage({
          botId: completedJob.botId,
          chatId: completedJob.chatId,
          text: `로컬 작업 실패: ${completedJob.jobId}\n잠시 후 재시도하거나 /ops 로 상태를 확인하세요.`,
          replyToMessageId
        }).catch(() => undefined);
      }
    }

    return ok({
      ok: true,
      job: completedJob
    });
  } catch (caught) {
    return fail("local job complete failed", 500, {
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
