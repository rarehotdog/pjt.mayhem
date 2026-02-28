import { nanoid } from "nanoid";

import { buildDailyFortune, buildFullReport, buildPreview } from "@/lib/report-engine";
import { getProductPrice } from "@/lib/payment";
import { getSupabaseAdmin } from "@/lib/supabase";
import type {
  AttributionParams,
  ConsentState,
  DailyFortune,
  Entitlement,
  FullReport,
  InviteLink,
  PaymentOrder,
  PaymentProductCode,
  PreviewReport,
  SessionData,
  ShareCard,
  UserProfile
} from "@/lib/types";

interface MemoryStore {
  sessions: Map<string, SessionData>;
  consents: Map<string, ConsentState>;
  profiles: Map<string, UserProfile>;
  previewReports: Map<string, PreviewReport>;
  fullReports: Map<string, FullReport>;
  paymentOrders: Map<string, PaymentOrder>;
  paymentOrderByIdempotency: Map<string, string>;
  entitlements: Map<string, Entitlement>;
  shareCards: Map<string, ShareCard>;
  invites: Map<string, InviteLink>;
  dailyCache: Map<string, DailyFortune>;
}

const globalKey = "__UNMYEONG_SNAP_STORE__";

type GlobalWithStore = typeof globalThis & {
  [globalKey]?: MemoryStore;
};

const globalObj = globalThis as GlobalWithStore;

export const store: MemoryStore =
  globalObj[globalKey] ??
  {
    sessions: new Map(),
    consents: new Map(),
    profiles: new Map(),
    previewReports: new Map(),
    fullReports: new Map(),
    paymentOrders: new Map(),
    paymentOrderByIdempotency: new Map(),
    entitlements: new Map(),
    shareCards: new Map(),
    invites: new Map(),
    dailyCache: new Map()
  };

globalObj[globalKey] = store;

function toSnakeCaseKey(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replaceAll("-", "_")
    .toLowerCase();
}

function toSnakeRecord(row: object) {
  return Object.fromEntries(
    Object.entries(row as Record<string, unknown>).map(([key, value]) => [toSnakeCaseKey(key), value])
  );
}

async function persistUpsert(table: string, row: object) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from(table as never)
    .upsert(toSnakeRecord(row) as never)
    .throwOnError();
}

async function persistInsert(table: string, row: object) {
  const supabase = getSupabaseAdmin();
  await supabase
    .from(table as never)
    .insert(toSnakeRecord(row) as never)
    .throwOnError();
}

async function fetchOne(table: string, filters: Record<string, unknown>) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(table as never).select("*");

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(toSnakeCaseKey(key), value as never);
  }

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }
  return (data as Record<string, unknown> | null) ?? null;
}

async function fetchMany(
  table: string,
  filters: Record<string, unknown>,
  options?: { orderBy?: string; ascending?: boolean; limit?: number }
) {
  const supabase = getSupabaseAdmin();
  let query = supabase.from(table as never).select("*");

  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(toSnakeCaseKey(key), value as never);
  }

  if (options?.orderBy) {
    query = query.order(toSnakeCaseKey(options.orderBy), { ascending: options.ascending ?? false });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return (data as Array<Record<string, unknown>>) ?? [];
}

function createDefaultConsent(): ConsentState {
  return {
    essentialAnalytics: true,
    marketingTracking: false,
    updatedAt: new Date().toISOString()
  };
}

function toAttribution(row: Record<string, unknown> | null | undefined): AttributionParams | undefined {
  if (!row) {
    return undefined;
  }

  const attribution: AttributionParams = {
    campaign_id: typeof row.campaign_id === "string" ? row.campaign_id : undefined,
    click_source: typeof row.click_source === "string" ? row.click_source : undefined,
    partition: typeof row.partition === "string" ? row.partition : undefined,
    ua_creative_topic: typeof row.ua_creative_topic === "string" ? row.ua_creative_topic : undefined,
    utm_source: typeof row.utm_source === "string" ? row.utm_source : undefined,
    source: typeof row.source === "string" ? row.source : undefined,
    mode: typeof row.mode === "string" ? row.mode : undefined
  };

  return Object.values(attribution).some((value) => Boolean(value)) ? attribution : undefined;
}

function hydrateSession(row: Record<string, unknown>): SessionData {
  const session: SessionData = {
    sessionId: String(row.session_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    userAgent: typeof row.user_agent === "string" ? row.user_agent : undefined,
    attribution: toAttribution((row.attribution as Record<string, unknown> | undefined) ?? undefined)
  };

  store.sessions.set(session.sessionId, session);
  return session;
}

function hydrateConsent(sessionId: string, row: Record<string, unknown>): ConsentState {
  const consent: ConsentState = {
    essentialAnalytics: true,
    marketingTracking: Boolean(row.marketing_tracking),
    updatedAt: String(row.updated_at ?? new Date().toISOString())
  };

  store.consents.set(sessionId, consent);
  return consent;
}

function hydrateProfile(row: Record<string, unknown>): UserProfile {
  const profile: UserProfile = {
    sessionId: String(row.session_id),
    name: String(row.name),
    birthDate: String(row.birth_date),
    birthTime: typeof row.birth_time === "string" ? row.birth_time : undefined,
    isBirthTimeUnknown: Boolean(row.is_birth_time_unknown),
    calendarType: row.calendar_type as UserProfile["calendarType"],
    gender: row.gender as UserProfile["gender"],
    concernTopic: row.concern_topic as UserProfile["concernTopic"],
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };

  store.profiles.set(profile.sessionId, profile);
  return profile;
}

function hydratePreviewReport(row: Record<string, unknown>): PreviewReport {
  const summary = Array.isArray(row.summary) ? row.summary : [];
  const preview: PreviewReport = {
    reportId: String(row.report_id),
    sessionId: String(row.session_id),
    summary: [String(summary[0] ?? ""), String(summary[1] ?? ""), String(summary[2] ?? "")],
    actionCard: String(row.action_card),
    blurredDetail: String(row.blurred_detail),
    priceKRW: Number(row.price_krw),
    createdAt: String(row.created_at)
  };

  store.previewReports.set(preview.reportId, preview);
  return preview;
}

function hydrateFullReport(row: Record<string, unknown>): FullReport {
  const sections = (row.sections as Record<string, unknown>) ?? {};
  const report: FullReport = {
    reportId: String(row.report_id),
    sessionId: String(row.session_id),
    sections: {
      love: String(sections.love ?? ""),
      wealth: String(sections.wealth ?? ""),
      relationship: String(sections.relationship ?? ""),
      career: String(sections.career ?? ""),
      health: String(sections.health ?? "")
    },
    weeklyActionCard: String(row.weekly_action_card),
    disclaimer: String(row.disclaimer),
    createdAt: String(row.created_at)
  };

  store.fullReports.set(report.reportId, report);
  return report;
}

function hydratePaymentOrder(row: Record<string, unknown>): PaymentOrder {
  const order: PaymentOrder = {
    orderId: String(row.order_id),
    sessionId: String(row.session_id),
    reportId: String(row.report_id),
    productCode: row.product_code as PaymentProductCode,
    amountKRW: Number(row.amount_krw),
    currency: "KRW",
    status: row.status as PaymentOrder["status"],
    provider: "portone",
    idempotencyKey: String(row.idempotency_key),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at)
  };

  store.paymentOrders.set(order.orderId, order);
  store.paymentOrderByIdempotency.set(order.idempotencyKey, order.orderId);
  return order;
}

function hydrateEntitlement(row: Record<string, unknown>): Entitlement {
  const entitlement: Entitlement = {
    entitlementId: String(row.entitlement_id),
    sessionId: String(row.session_id),
    reportId: String(row.report_id),
    productCode: row.product_code as PaymentProductCode,
    status: row.status as Entitlement["status"],
    createdAt: String(row.created_at),
    expiresAt: typeof row.expires_at === "string" ? row.expires_at : undefined
  };

  store.entitlements.set(entitlement.entitlementId, entitlement);
  return entitlement;
}

function hydrateInvite(row: Record<string, unknown>): InviteLink {
  const invite: InviteLink = {
    code: String(row.code),
    ownerSessionId: String(row.owner_session_id),
    reportId: String(row.report_id),
    createdAt: String(row.created_at),
    redeemedBy: Array.isArray(row.redeemed_by) ? row.redeemed_by.map(String) : []
  };

  store.invites.set(invite.code, invite);
  return invite;
}

export async function createSession(attribution?: AttributionParams, userAgent?: string) {
  const now = new Date().toISOString();
  const session: SessionData = {
    sessionId: nanoid(18),
    createdAt: now,
    updatedAt: now,
    userAgent,
    attribution
  };

  store.sessions.set(session.sessionId, session);
  await persistUpsert("sessions", session);

  if (attribution && Object.values(attribution).some((value) => Boolean(value))) {
    await persistInsert("attribution_snapshots", {
      sessionId: session.sessionId,
      ...attribution,
      createdAt: now
    });
  }

  await getOrCreateConsent(session.sessionId);
  return session;
}

export async function getSession(sessionId: string | undefined) {
  if (!sessionId) {
    return null;
  }

  const cached = store.sessions.get(sessionId);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("sessions", { sessionId });
  if (!row) {
    return null;
  }

  return hydrateSession(row);
}

export async function getOrCreateConsent(sessionId: string): Promise<ConsentState> {
  const cached = store.consents.get(sessionId);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("user_consents", { sessionId });
  if (row) {
    return hydrateConsent(sessionId, row);
  }

  const created = createDefaultConsent();
  store.consents.set(sessionId, created);

  await persistUpsert("user_consents", {
    sessionId,
    essentialAnalytics: true,
    marketingTracking: false,
    updatedAt: created.updatedAt
  });

  return created;
}

export async function updateConsent(sessionId: string, marketingTracking: boolean): Promise<ConsentState> {
  const consent: ConsentState = {
    essentialAnalytics: true,
    marketingTracking,
    updatedAt: new Date().toISOString()
  };

  store.consents.set(sessionId, consent);
  await persistUpsert("user_consents", {
    sessionId,
    essentialAnalytics: true,
    marketingTracking,
    updatedAt: consent.updatedAt
  });

  return consent;
}

export async function getConsent(sessionId: string | undefined) {
  if (!sessionId) {
    return null;
  }

  const cached = store.consents.get(sessionId);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("user_consents", { sessionId });
  if (!row) {
    return null;
  }

  return hydrateConsent(sessionId, row);
}

export async function upsertProfile(input: Omit<UserProfile, "createdAt" | "updatedAt">) {
  const now = new Date().toISOString();
  const existing = (await getProfile(input.sessionId)) ?? undefined;
  const profile: UserProfile = {
    ...input,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };

  store.profiles.set(input.sessionId, profile);
  await persistUpsert("profiles", profile);
  return profile;
}

export async function getProfile(sessionId: string | undefined) {
  if (!sessionId) {
    return null;
  }

  const cached = store.profiles.get(sessionId);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("profiles", { sessionId });
  if (!row) {
    return null;
  }

  return hydrateProfile(row);
}

export async function createPreviewReport(sessionId: string) {
  const profile = await getProfile(sessionId);
  if (!profile) {
    return null;
  }

  const reportId = nanoid(16);
  const preview = buildPreview(profile, reportId);
  store.previewReports.set(reportId, preview);

  await persistUpsert("preview_reports", preview);
  return preview;
}

export async function getPreviewReport(reportId: string | undefined) {
  if (!reportId) {
    return null;
  }

  const cached = store.previewReports.get(reportId);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("preview_reports", { reportId });
  if (!row) {
    return null;
  }

  return hydratePreviewReport(row);
}

export async function getFullReport(reportId: string | undefined) {
  if (!reportId) {
    return null;
  }

  const cached = store.fullReports.get(reportId);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("full_reports", { reportId });
  if (!row) {
    return null;
  }

  return hydrateFullReport(row);
}

export async function getOrCreateFullReport(sessionId: string, reportId: string) {
  const existing = await getFullReport(reportId);
  if (existing) {
    return existing;
  }

  const profile = await getProfile(sessionId);
  if (!profile) {
    return null;
  }

  const full = buildFullReport(profile, reportId);
  store.fullReports.set(reportId, full);
  await persistUpsert("full_reports", full);
  return full;
}

async function getPaymentOrderByIdempotency(idempotencyKey: string) {
  const linkedOrder = store.paymentOrderByIdempotency.get(idempotencyKey);
  if (linkedOrder) {
    const existing = await getPaymentOrder(linkedOrder);
    if (existing) {
      return existing;
    }
  }

  const row = await fetchOne("payment_orders", { idempotencyKey });
  if (!row) {
    return null;
  }

  return hydratePaymentOrder(row);
}

export async function createPaymentOrder(
  sessionId: string,
  reportId: string,
  productCode: PaymentProductCode,
  idempotencyKey: string
) {
  const existing = await getPaymentOrderByIdempotency(idempotencyKey);
  if (existing) {
    return existing;
  }

  const now = new Date().toISOString();
  const order: PaymentOrder = {
    orderId: nanoid(14),
    sessionId,
    reportId,
    productCode,
    amountKRW: getProductPrice(productCode),
    currency: "KRW",
    status: "created",
    provider: "portone",
    idempotencyKey,
    createdAt: now,
    updatedAt: now
  };

  store.paymentOrders.set(order.orderId, order);
  store.paymentOrderByIdempotency.set(idempotencyKey, order.orderId);

  try {
    await persistUpsert("payment_orders", order);
  } catch (caught) {
    const error = caught as { code?: string };
    if (error?.code === "23505") {
      const conflicted = await getPaymentOrderByIdempotency(idempotencyKey);
      if (conflicted) {
        return conflicted;
      }
    }
    throw caught;
  }

  return order;
}

export async function getPaymentOrder(orderId: string | undefined) {
  if (!orderId) {
    return null;
  }

  const cached = store.paymentOrders.get(orderId);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("payment_orders", { orderId });
  if (!row) {
    return null;
  }

  return hydratePaymentOrder(row);
}

export async function confirmPaymentOrder(orderId: string, status: PaymentOrder["status"]) {
  const order = await getPaymentOrder(orderId);
  if (!order) {
    return null;
  }

  if (order.status === "paid") {
    return order;
  }

  order.status = status;
  order.updatedAt = new Date().toISOString();
  store.paymentOrders.set(orderId, order);

  await persistUpsert("payment_orders", order);
  return order;
}

export async function grantEntitlement(order: PaymentOrder) {
  const now = new Date();
  const entitlementId = nanoid(14);
  const expiresAt =
    order.productCode === "premium_monthly_4900"
      ? new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString()
      : undefined;

  const entitlement: Entitlement = {
    entitlementId,
    sessionId: order.sessionId,
    reportId: order.reportId,
    productCode: order.productCode,
    status: "active",
    createdAt: now.toISOString(),
    expiresAt
  };

  store.entitlements.set(entitlementId, entitlement);
  await persistUpsert("entitlements", entitlement);
  return entitlement;
}

export async function findActiveEntitlement(sessionId: string, reportId: string) {
  const cached = [...store.entitlements.values()].find((item) => {
    if (item.sessionId !== sessionId || item.reportId !== reportId || item.status !== "active") {
      return false;
    }
    if (!item.expiresAt) {
      return true;
    }
    return new Date(item.expiresAt) > new Date();
  });

  if (cached) {
    return cached;
  }

  const rows = await fetchMany(
    "entitlements",
    {
      sessionId,
      reportId,
      status: "active"
    },
    {
      orderBy: "createdAt",
      ascending: false,
      limit: 20
    }
  );

  for (const row of rows) {
    const entitlement = hydrateEntitlement(row);
    if (!entitlement.expiresAt || new Date(entitlement.expiresAt) > new Date()) {
      return entitlement;
    }
  }

  return null;
}

export async function hasActiveEntitlement(sessionId: string, reportId: string) {
  return Boolean(await findActiveEntitlement(sessionId, reportId));
}

export async function createShareCard(
  sessionId: string,
  reportId: string,
  headline: string,
  subline: string,
  actionLine: string
) {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1080' height='1920'>
  <defs>
    <linearGradient id='bg' x1='0' x2='1' y1='0' y2='1'>
      <stop offset='0%' stop-color='#14111f'/>
      <stop offset='100%' stop-color='#ff7159'/>
    </linearGradient>
  </defs>
  <rect width='100%' height='100%' fill='url(#bg)'/>
  <circle cx='930' cy='240' r='220' fill='#68d7b8' fill-opacity='0.35'/>
  <circle cx='120' cy='1600' r='280' fill='#7ac7f8' fill-opacity='0.25'/>
  <text x='84' y='220' fill='#fff8ee' font-size='62' font-family='Noto Sans KR, sans-serif' font-weight='700'>운명스냅</text>
  <text x='84' y='420' fill='#fff8ee' font-size='78' font-family='Noto Sans KR, sans-serif' font-weight='800'>${escapeXml(
    headline
  )}</text>
  <text x='84' y='560' fill='#ffe0be' font-size='42' font-family='Noto Sans KR, sans-serif'>${escapeXml(
    subline
  )}</text>
  <text x='84' y='700' fill='#fff8ee' font-size='36' font-family='Noto Sans KR, sans-serif'>${escapeXml(
    actionLine
  )}</text>
  <rect x='84' y='1540' width='912' height='220' rx='36' fill='rgba(20,17,31,0.5)'/>
  <text x='130' y='1650' fill='#fff8ee' font-size='44' font-family='Noto Sans KR, sans-serif'>오늘의 행동 1개만 실행해도</text>
  <text x='130' y='1720' fill='#fff8ee' font-size='44' font-family='Noto Sans KR, sans-serif'>다음 기회가 당겨집니다</text>
</svg>`;

  const card: ShareCard = {
    cardId: nanoid(16),
    reportId,
    sessionId,
    headline,
    subline,
    actionLine,
    imageSvgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    createdAt: new Date().toISOString()
  };

  store.shareCards.set(card.cardId, card);
  await persistUpsert("share_cards", card);
  return card;
}

export async function createInviteLink(sessionId: string, reportId: string) {
  const invite: InviteLink = {
    code: nanoid(10),
    ownerSessionId: sessionId,
    reportId,
    createdAt: new Date().toISOString(),
    redeemedBy: []
  };

  store.invites.set(invite.code, invite);
  await persistUpsert("invites", invite);
  return invite;
}

export async function getInvite(code: string | undefined) {
  if (!code) {
    return null;
  }

  const cached = store.invites.get(code);
  if (cached) {
    return cached;
  }

  const row = await fetchOne("invites", { code });
  if (!row) {
    return null;
  }

  return hydrateInvite(row);
}

export async function redeemInvite(code: string, redeemerSessionId: string) {
  const invite = await getInvite(code);
  if (!invite) {
    return null;
  }

  if (!invite.redeemedBy.includes(redeemerSessionId)) {
    invite.redeemedBy.push(redeemerSessionId);
  }

  store.invites.set(code, invite);
  await persistUpsert("invites", invite);
  return invite;
}

export function getDailyFortune(date: string, sessionId?: string) {
  const cacheKey = `${date}:${sessionId ?? "global"}`;
  const cached = store.dailyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const daily = buildDailyFortune(date, sessionId);
  store.dailyCache.set(cacheKey, daily);
  return daily;
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
