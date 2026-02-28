import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("telegram webhook dynamic route", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.TELEGRAM_BOT_COS_TOKEN = "cos-token";
    process.env.TELEGRAM_BOT_COS_SECRET = "correct-secret";
    process.env.TELEGRAM_ALLOWED_USER_IDS = "111";
    process.env.OPENAI_API_KEY = "openai-key";
    process.env.ANTHROPIC_API_KEY = "anthropic-key";
  });

  it("returns 404 for unknown bot id", async () => {
    const route = await import("@/app/api/telegram/webhook/[botId]/route");
    const request = new NextRequest("http://localhost:3000/api/telegram/webhook/unknown", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "correct-secret"
      },
      body: JSON.stringify({ update_id: 1 })
    });

    const response = await route.POST(request, {
      params: {
        botId: "unknown"
      }
    });
    expect(response.status).toBe(404);
  });

  it("returns 403 for secret mismatch", async () => {
    const route = await import("@/app/api/telegram/webhook/[botId]/route");
    const request = new NextRequest("http://localhost:3000/api/telegram/webhook/tyler_durden", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Telegram-Bot-Api-Secret-Token": "wrong-secret"
      },
      body: JSON.stringify({ update_id: 1 })
    });

    const response = await route.POST(request, {
      params: {
        botId: "tyler_durden"
      }
    });
    expect(response.status).toBe(403);
  });
});
