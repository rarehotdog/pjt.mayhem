import { cookies, headers } from "next/headers";
import type { AttributionParams } from "@/lib/types";

const SESSION_COOKIE_KEY = "us_session";

export function getSessionIdFromRequest(bodySessionId?: string) {
  const cookieStore = cookies();
  const fromCookie = cookieStore.get(SESSION_COOKIE_KEY)?.value;
  return bodySessionId ?? fromCookie ?? null;
}

export function setSessionCookie(sessionId: string) {
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_KEY, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 90
  });
}

export function getUserAgent() {
  return headers().get("user-agent") ?? undefined;
}

export function getAttributionFromCookie() {
  const raw = cookies().get("us_utm")?.value;
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const attribution: AttributionParams = {
      campaign_id: typeof parsed.campaign_id === "string" ? parsed.campaign_id : undefined,
      click_source: typeof parsed.click_source === "string" ? parsed.click_source : undefined,
      partition: typeof parsed.partition === "string" ? parsed.partition : undefined,
      ua_creative_topic: typeof parsed.ua_creative_topic === "string" ? parsed.ua_creative_topic : undefined,
      utm_source: typeof parsed.utm_source === "string" ? parsed.utm_source : undefined,
      source: typeof parsed.source === "string" ? parsed.source : undefined,
      mode: typeof parsed.mode === "string" ? parsed.mode : undefined
    };
    return attribution;
  } catch {
    return undefined;
  }
}
