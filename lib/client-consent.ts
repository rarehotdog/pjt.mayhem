import type { AttributionParams, ConsentState } from "@/lib/types";

const CONSENT_KEY = "us_consent_state";
const SESSION_KEY = "us_session_id";
const ATTRIBUTION_KEY = "us_utm";

export function defaultConsentState(): ConsentState {
  return {
    essentialAnalytics: true,
    marketingTracking: false,
    updatedAt: new Date().toISOString()
  };
}

export function getClientConsentState(): ConsentState {
  if (typeof window === "undefined") {
    return defaultConsentState();
  }

  const raw = window.localStorage.getItem(CONSENT_KEY);
  if (!raw) {
    return defaultConsentState();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    return {
      essentialAnalytics: true,
      marketingTracking: Boolean(parsed.marketingTracking),
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    return defaultConsentState();
  }
}

export function setClientConsentState(consent: ConsentState) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
}

export function getClientSessionId() {
  if (typeof window === "undefined") {
    return undefined;
  }
  return window.localStorage.getItem(SESSION_KEY) ?? undefined;
}

export function setClientSessionId(sessionId: string) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SESSION_KEY, sessionId);
}

export function getClientAttribution(): AttributionParams {
  if (typeof window === "undefined") {
    return {};
  }

  const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      campaign_id: typeof parsed.campaign_id === "string" ? parsed.campaign_id : undefined,
      click_source: typeof parsed.click_source === "string" ? parsed.click_source : undefined,
      partition: typeof parsed.partition === "string" ? parsed.partition : undefined,
      ua_creative_topic: typeof parsed.ua_creative_topic === "string" ? parsed.ua_creative_topic : undefined,
      utm_source: typeof parsed.utm_source === "string" ? parsed.utm_source : undefined,
      source: typeof parsed.source === "string" ? parsed.source : undefined,
      mode: typeof parsed.mode === "string" ? parsed.mode : undefined
    };
  } catch {
    return {};
  }
}
