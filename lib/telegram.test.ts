import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendTelegramMessage } from "@/lib/telegram";

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json"
    }
  });
}

describe("telegram sendMessage", () => {
  const envBackup = {
    TELEGRAM_BOT_COS_TOKEN: process.env.TELEGRAM_BOT_COS_TOKEN
  };

  beforeEach(() => {
    process.env.TELEGRAM_BOT_COS_TOKEN = "token-cos";
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.TELEGRAM_BOT_COS_TOKEN = envBackup.TELEGRAM_BOT_COS_TOKEN;
    vi.restoreAllMocks();
  });

  it("sends message in one shot when no migration is required", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        ok: true,
        result: {
          message_id: 777
        }
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTelegramMessage({
      botId: "tyler_durden",
      chatId: -111,
      text: "hello"
    });

    expect(result.message_id).toBe(777);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with migrate_to_chat_id when chat was upgraded", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(400, {
          ok: false,
          error_code: 400,
          description: "Bad Request: group chat was upgraded to a supergroup chat",
          parameters: {
            migrate_to_chat_id: -1005068790852
          }
        })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          ok: true,
          result: {
            message_id: 888
          }
        })
      );

    vi.stubGlobal("fetch", fetchMock);

    const result = await sendTelegramMessage({
      botId: "tyler_durden",
      chatId: -5068790852,
      text: "retry"
    });

    expect(result.message_id).toBe(888);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const firstBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    const secondBody = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));

    expect(firstBody.chat_id).toBe(-5068790852);
    expect(secondBody.chat_id).toBe(-1005068790852);
  });
});
