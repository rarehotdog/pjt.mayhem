import { nanoid } from "nanoid";

import { getClientAttribution, getClientConsentState, getClientSessionId } from "@/lib/client-consent";
import type { ConsentState, TelemetryEventType } from "@/lib/types";

interface TrackClientEventInput {
  eventName: string;
  eventType?: TelemetryEventType;
  payload?: Record<string, unknown>;
  pagePath?: string;
  sourceChannel?: string;
  sessionId?: string;
  consentSnapshot?: ConsentState;
  dedupeKey?: string;
  useBeacon?: boolean;
}

const DEDUPE_TTL_MS = 1500;
const dedupeCache = new Map<string, number>();

function normalizeInput(
  eventOrName: string | TrackClientEventInput,
  payload?: Record<string, unknown>,
  sessionId?: string
): TrackClientEventInput {
  if (typeof eventOrName === "string") {
    return {
      eventName: eventOrName,
      payload,
      sessionId
    };
  }
  return eventOrName;
}

function shouldSkipDuplicate(key: string) {
  const now = Date.now();
  const last = dedupeCache.get(key);
  dedupeCache.set(key, now);

  for (const [cachedKey, timestamp] of dedupeCache.entries()) {
    if (now - timestamp > DEDUPE_TTL_MS * 2) {
      dedupeCache.delete(cachedKey);
    }
  }

  if (!last) {
    return false;
  }
  return now - last < DEDUPE_TTL_MS;
}

function postWithBeacon(body: unknown) {
  if (typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
  return navigator.sendBeacon("/api/telemetry", blob);
}

export async function trackClientEvent(
  eventOrName: string | TrackClientEventInput,
  payload?: Record<string, unknown>,
  sessionId?: string
) {
  if (typeof window === "undefined") {
    return;
  }

  const input = normalizeInput(eventOrName, payload, sessionId);
  const consent = input.consentSnapshot ?? getClientConsentState();
  const resolvedSessionId = input.sessionId ?? getClientSessionId();
  const pagePath = input.pagePath ?? window.location.pathname;
  const sourceChannel = input.sourceChannel ?? "web";
  const eventType = input.eventType ?? "product";

  if (eventType === "marketing" && !consent.marketingTracking) {
    return;
  }

  const dedupeKey =
    input.dedupeKey ?? `${input.eventName}:${pagePath}:${resolvedSessionId ?? "anonymous"}:${eventType}`;
  if (shouldSkipDuplicate(dedupeKey)) {
    return;
  }

  const body = {
    eventId: nanoid(16),
    eventName: input.eventName,
    eventType,
    eventTime: new Date().toISOString(),
    sessionId: resolvedSessionId,
    pagePath,
    sourceChannel,
    consentSnapshot: consent,
    payload: {
      ...getClientAttribution(),
      ...(input.payload ?? {})
    }
  };

  try {
    const response = await fetch("/api/telemetry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true
    });

    if (!response.ok && input.useBeacon) {
      postWithBeacon(body);
    }
  } catch {
    postWithBeacon(body);
  }
}
