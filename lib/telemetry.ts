import { nanoid } from "nanoid";

import { getOrCreateConsent, getSession } from "@/lib/store";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  AttributionParams,
  ConsentState,
  EventDeliveryLog,
  TelemetryDeliveryStatus,
  TelemetryEvent,
  TelemetryEventType
} from "@/lib/types";

const META_EVENT_MAP: Record<string, string> = {
  preview_viewed: "ViewContent",
  payment_create_requested: "InitiateCheckout",
  payment_confirmed: "Purchase"
};

export interface TelemetryRequestContext {
  ip?: string;
  userAgent?: string;
  url?: string;
}

export interface TrackServerEventInput {
  eventId?: string;
  eventName: string;
  eventType?: TelemetryEventType;
  eventTime?: string;
  sessionId?: string;
  pagePath?: string;
  sourceChannel?: string;
  consentSnapshot?: ConsentState;
  payload?: Record<string, unknown>;
  context?: TelemetryRequestContext;
  disableFanOut?: boolean;
}

function isStagingEnv() {
  return (
    process.env.UNMYEONG_STAGE === "staging" ||
    process.env.NODE_ENV !== "production" ||
    process.env.VERCEL_ENV === "preview"
  );
}

function getAmplitudeApiKey() {
  if (isStagingEnv()) {
    return process.env.AMPLITUDE_API_KEY_STAGING ?? process.env.AMPLITUDE_API_KEY ?? "";
  }
  return process.env.AMPLITUDE_API_KEY ?? "";
}

function getMetaPixelId() {
  if (isStagingEnv()) {
    return process.env.META_TEST_PIXEL_ID ?? process.env.META_PIXEL_ID ?? "";
  }
  return process.env.META_PIXEL_ID ?? "";
}

function getMetaAccessToken() {
  return process.env.META_ACCESS_TOKEN ?? "";
}

function getMetaTestEventCode() {
  if (isStagingEnv()) {
    return process.env.META_TEST_EVENT_CODE ?? "";
  }
  return "";
}

function toAttribution(payload: Record<string, unknown>): AttributionParams {
  return {
    campaign_id: typeof payload.campaign_id === "string" ? payload.campaign_id : undefined,
    click_source: typeof payload.click_source === "string" ? payload.click_source : undefined,
    partition: typeof payload.partition === "string" ? payload.partition : undefined,
    ua_creative_topic: typeof payload.ua_creative_topic === "string" ? payload.ua_creative_topic : undefined,
    utm_source: typeof payload.utm_source === "string" ? payload.utm_source : undefined,
    source: typeof payload.source === "string" ? payload.source : undefined,
    mode: typeof payload.mode === "string" ? payload.mode : undefined
  };
}

function normalizeDelivery(
  eventType: TelemetryEventType,
  consentMarketing: boolean,
  eventName: string
): TelemetryDeliveryStatus {
  const hasMetaMapping = Boolean(META_EVENT_MAP[eventName]);

  return {
    amplitude: "pending",
    meta: eventType === "marketing" && consentMarketing && hasMetaMapping ? "pending" : "skipped"
  };
}

function toDbEventRow(event: TelemetryEvent) {
  return {
    event_id: event.eventId,
    event_name: event.eventName,
    event_type: event.eventType,
    event_time: event.eventTime,
    session_id: event.sessionId ?? null,
    page_path: event.pagePath,
    source_channel: event.sourceChannel,
    consent_marketing: event.consentMarketing,
    payload: event.payload,
    campaign_id: event.attribution.campaign_id ?? null,
    click_source: event.attribution.click_source ?? null,
    partition: event.attribution.partition ?? null,
    ua_creative_topic: event.attribution.ua_creative_topic ?? null,
    utm_source: event.attribution.utm_source ?? null,
    source: event.attribution.source ?? null,
    mode: event.attribution.mode ?? null,
    delivery_amplitude: event.delivery.amplitude,
    delivery_meta: event.delivery.meta,
    retry_count: event.retryCount,
    created_at: event.createdAt
  };
}

function toDbDeliveryLog(log: EventDeliveryLog) {
  return {
    event_id: log.eventId,
    destination: log.destination,
    status: log.status,
    attempt: log.attempt,
    error: log.error ?? null,
    created_at: log.createdAt
  };
}

async function writeDeliveryLog(log: EventDeliveryLog) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("event_delivery_logs")
    .insert(toDbDeliveryLog(log) as never)
    .throwOnError();
}

async function updateEventDelivery(eventId: string, delivery: TelemetryDeliveryStatus, retryCount: number) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from("telemetry_events")
    .update({
      delivery_amplitude: delivery.amplitude,
      delivery_meta: delivery.meta,
      retry_count: retryCount
    } as never)
    .eq("event_id", eventId as never)
    .throwOnError();
}

async function getExistingEvent(eventId: string) {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("telemetry_events")
    .select("*")
    .eq("event_id", eventId as never)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return toTelemetryEvent(data);
}

function toTelemetryEvent(row: Record<string, unknown>): TelemetryEvent {
  return {
    eventId: String(row.event_id),
    eventName: String(row.event_name),
    eventType: row.event_type as TelemetryEventType,
    eventTime: String(row.event_time),
    sessionId: typeof row.session_id === "string" ? row.session_id : undefined,
    pagePath: String(row.page_path),
    sourceChannel: String(row.source_channel),
    consentMarketing: Boolean(row.consent_marketing),
    payload: (row.payload as Record<string, unknown>) ?? {},
    attribution: {
      campaign_id: typeof row.campaign_id === "string" ? row.campaign_id : undefined,
      click_source: typeof row.click_source === "string" ? row.click_source : undefined,
      partition: typeof row.partition === "string" ? row.partition : undefined,
      ua_creative_topic: typeof row.ua_creative_topic === "string" ? row.ua_creative_topic : undefined,
      utm_source: typeof row.utm_source === "string" ? row.utm_source : undefined,
      source: typeof row.source === "string" ? row.source : undefined,
      mode: typeof row.mode === "string" ? row.mode : undefined
    },
    delivery: {
      amplitude: row.delivery_amplitude as TelemetryDeliveryStatus["amplitude"],
      meta: row.delivery_meta as TelemetryDeliveryStatus["meta"]
    },
    retryCount: Number(row.retry_count ?? 0),
    createdAt: String(row.created_at)
  };
}

function redactLongError(value: string) {
  return value.length > 500 ? `${value.slice(0, 497)}...` : value;
}

async function postAmplitude(event: TelemetryEvent) {
  const apiKey = getAmplitudeApiKey();
  if (!apiKey) {
    throw new Error("Amplitude API key is missing");
  }

  const response = await fetch("https://api2.amplitude.com/2/httpapi", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      api_key: apiKey,
      events: [
        {
          event_type: event.eventName,
          event_id: event.eventId,
          time: new Date(event.eventTime).getTime(),
          device_id: event.sessionId,
          user_id: event.sessionId,
          platform: "Web",
          event_properties: {
            ...event.payload,
            page_path: event.pagePath,
            source_channel: event.sourceChannel,
            consent_marketing: event.consentMarketing,
            campaign_id: event.attribution.campaign_id,
            click_source: event.attribution.click_source,
            partition: event.attribution.partition,
            ua_creative_topic: event.attribution.ua_creative_topic,
            utm_source: event.attribution.utm_source,
            source: event.attribution.source,
            mode: event.attribution.mode
          }
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Amplitude HTTP ${response.status}: ${redactLongError(text)}`);
  }
}

async function postMeta(event: TelemetryEvent, context?: TelemetryRequestContext) {
  const mappedEventName = META_EVENT_MAP[event.eventName];
  if (!mappedEventName) {
    return "skipped" as const;
  }

  const pixelId = getMetaPixelId();
  const accessToken = getMetaAccessToken();

  if (!pixelId || !accessToken) {
    throw new Error("Meta test pixel or access token is missing");
  }

  const value = typeof event.payload.amount_krw === "number" ? event.payload.amount_krw : undefined;

  const body: Record<string, unknown> = {
    data: [
      {
        event_name: mappedEventName,
        event_time: Math.floor(new Date(event.eventTime).getTime() / 1000),
        event_id: event.eventId,
        action_source: "website",
        event_source_url: context?.url,
        user_data: {
          client_ip_address: context?.ip,
          client_user_agent: context?.userAgent
        },
        custom_data: {
          currency: "KRW",
          value,
          report_id: event.payload.report_id,
          product_code: event.payload.product_code,
          order_id: event.payload.order_id,
          payment_status: event.payload.payment_status,
          campaign_id: event.attribution.campaign_id,
          click_source: event.attribution.click_source,
          partition: event.attribution.partition,
          ua_creative_topic: event.attribution.ua_creative_topic,
          utm_source: event.attribution.utm_source,
          source: event.attribution.source,
          mode: event.attribution.mode
        }
      }
    ]
  };

  const testEventCode = getMetaTestEventCode();
  if (testEventCode) {
    body.test_event_code = testEventCode;
  }

  const response = await fetch(`https://graph.facebook.com/v20.0/${pixelId}/events?access_token=${accessToken}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Meta HTTP ${response.status}: ${redactLongError(text)}`);
  }

  return "sent" as const;
}

async function persistTelemetryDeliveryFailed(parent: TelemetryEvent, destination: "amplitude" | "meta", error: string) {
  if (parent.eventName === "telemetry_delivery_failed") {
    return;
  }

  const now = new Date().toISOString();
  const event: TelemetryEvent = {
    eventId: nanoid(16),
    eventName: "telemetry_delivery_failed",
    eventType: "system",
    eventTime: now,
    sessionId: parent.sessionId,
    pagePath: "/api/telemetry",
    sourceChannel: "server",
    consentMarketing: false,
    payload: {
      parent_event_id: parent.eventId,
      parent_event_name: parent.eventName,
      destination,
      error
    },
    attribution: parent.attribution,
    delivery: {
      amplitude: "failed",
      meta: "skipped"
    },
    retryCount: 0,
    createdAt: now
  };

  const supabase = getSupabaseAdmin();
  await supabase
    .from("telemetry_events")
    .insert(toDbEventRow(event) as never)
    .throwOnError();
}

export async function trackServerEvent(input: TrackServerEventInput) {
  const now = new Date().toISOString();
  const payload = input.payload ?? {};
  const session = await getSession(input.sessionId);

  const consent =
    input.consentSnapshot ??
    (session?.sessionId ? await getOrCreateConsent(session.sessionId) : { essentialAnalytics: true, marketingTracking: false, updatedAt: now });

  const attributionFromPayload = toAttribution(payload);
  const attribution =
    Object.values(attributionFromPayload).some((value) => Boolean(value))
      ? attributionFromPayload
      : session?.attribution ?? {};

  const eventType = input.eventType ?? "product";
  const event: TelemetryEvent = {
    eventId: input.eventId ?? nanoid(16),
    eventName: input.eventName,
    eventType,
    eventTime: input.eventTime ?? now,
    sessionId: session?.sessionId ?? input.sessionId,
    pagePath: input.pagePath ?? "/",
    sourceChannel: input.sourceChannel ?? "web",
    consentMarketing: consent.marketingTracking,
    payload,
    attribution,
    delivery: normalizeDelivery(eventType, consent.marketingTracking, input.eventName),
    retryCount: 0,
    createdAt: now
  };

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("telemetry_events")
    .insert(toDbEventRow(event) as never);

  if (error) {
    if (error.code === "23505") {
      const existing = await getExistingEvent(event.eventId);
      if (existing) {
        return existing;
      }
    }
    throw error;
  }

  if (input.disableFanOut) {
    return event;
  }

  const delivery = { ...event.delivery };
  let retryCount = event.retryCount;

  try {
    await postAmplitude(event);
    delivery.amplitude = "sent";
    await writeDeliveryLog({
      eventId: event.eventId,
      destination: "amplitude",
      status: "sent",
      attempt: retryCount + 1,
      createdAt: new Date().toISOString()
    });
  } catch (caught) {
    retryCount += 1;
    delivery.amplitude = "failed";
    const message = caught instanceof Error ? caught.message : "amplitude delivery failed";
    await writeDeliveryLog({
      eventId: event.eventId,
      destination: "amplitude",
      status: "failed",
      attempt: retryCount,
      error: redactLongError(message),
      createdAt: new Date().toISOString()
    });
    await persistTelemetryDeliveryFailed(event, "amplitude", message);
  }

  if (delivery.meta === "skipped") {
    await writeDeliveryLog({
      eventId: event.eventId,
      destination: "meta",
      status: "skipped",
      attempt: 0,
      createdAt: new Date().toISOString()
    });
  } else {
    try {
      await postMeta(event, input.context);
      delivery.meta = "sent";
      await writeDeliveryLog({
        eventId: event.eventId,
        destination: "meta",
        status: "sent",
        attempt: retryCount + 1,
        createdAt: new Date().toISOString()
      });
    } catch (caught) {
      retryCount += 1;
      delivery.meta = "failed";
      const message = caught instanceof Error ? caught.message : "meta delivery failed";
      await writeDeliveryLog({
        eventId: event.eventId,
        destination: "meta",
        status: "failed",
        attempt: retryCount,
        error: redactLongError(message),
        createdAt: new Date().toISOString()
      });
      await persistTelemetryDeliveryFailed(event, "meta", message);
    }
  }

  await updateEventDelivery(event.eventId, delivery, retryCount);

  return {
    ...event,
    delivery,
    retryCount
  };
}

export function getTelemetryDestinationsHealth() {
  return {
    amplitudeConfigured: Boolean(getAmplitudeApiKey()),
    metaConfigured: Boolean(getMetaPixelId() && getMetaAccessToken()),
    stage: isStagingEnv() ? "staging" : "production"
  };
}
