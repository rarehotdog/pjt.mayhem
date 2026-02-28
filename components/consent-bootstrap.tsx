"use client";

import { useEffect, useMemo, useState } from "react";

import {
  defaultConsentState,
  getClientConsentState,
  setClientConsentState,
  setClientSessionId
} from "@/lib/client-consent";
import { trackClientEvent } from "@/lib/client-telemetry";
import type { ConsentState } from "@/lib/types";

const BANNER_DISMISSED_KEY = "us_consent_banner_dismissed";

function getBannerDismissed() {
  if (typeof window === "undefined") {
    return false;
  }
  return window.localStorage.getItem(BANNER_DISMISSED_KEY) === "1";
}

function setBannerDismissed(value: boolean) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(BANNER_DISMISSED_KEY, value ? "1" : "0");
}

export function ConsentBootstrap() {
  const [consent, setConsent] = useState<ConsentState>(defaultConsentState());
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await fetch("/api/consent", { method: "GET" });
        if (!response.ok) {
          throw new Error("동의 상태를 가져오지 못했습니다.");
        }

        const json = (await response.json()) as {
          sessionId: string;
          consent: ConsentState;
        };

        if (cancelled) {
          return;
        }

        setClientSessionId(json.sessionId);
        setClientConsentState(json.consent);
        setConsent(json.consent);
      } catch {
        const local = getClientConsentState();
        if (!cancelled) {
          setConsent(local);
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
          setOpen(!getBannerDismissed());
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  const marketingLabel = useMemo(
    () => (consent.marketingTracking ? "마케팅 추적 허용됨" : "마케팅 추적 비허용"),
    [consent.marketingTracking]
  );

  async function saveConsent(marketingTracking: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marketingTracking })
      });

      if (!response.ok) {
        throw new Error("동의 저장 실패");
      }

      const json = (await response.json()) as {
        sessionId: string;
        consent: ConsentState;
      };

      setClientSessionId(json.sessionId);
      setClientConsentState(json.consent);
      setConsent(json.consent);

      await trackClientEvent({
        eventName: "consent_updated",
        eventType: "system",
        pagePath: window.location.pathname,
        payload: {
          essential_analytics: true,
          marketing_tracking: json.consent.marketingTracking
        }
      });
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "동의 저장에 실패했습니다.";
      setError(message);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded || !open) {
    return null;
  }

  return (
    <section className="fixed inset-x-3 bottom-3 z-50 rounded-2xl border border-ink/20 bg-white/95 p-4 shadow-card backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-ink">분석/마케팅 동의</p>
          <p className="mt-1 text-xs leading-relaxed text-ink/70">
            필수 분석은 서비스 품질 개선을 위해 항상 활성화됩니다. 마케팅 추적은 선택입니다.
          </p>
        </div>
        <button
          type="button"
          className="rounded-lg border border-ink/15 px-2 py-1 text-xs font-semibold text-ink/70"
          onClick={() => {
            setOpen(false);
            setBannerDismissed(true);
          }}
        >
          닫기
        </button>
      </div>

      <div className="mt-3 grid gap-2 rounded-xl border border-ink/10 bg-cream/50 p-3 text-xs text-ink/80">
        <p>필수 분석: 항상 활성화</p>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={consent.marketingTracking}
            onChange={(event) => {
              const next: ConsentState = {
                ...consent,
                marketingTracking: event.target.checked,
                updatedAt: new Date().toISOString()
              };
              setConsent(next);
              setClientConsentState(next);
              void saveConsent(next.marketingTracking);
            }}
            disabled={saving}
          />
          <span>{marketingLabel}</span>
        </label>
      </div>

      {error ? <p className="mt-2 text-xs font-semibold text-coral">{error}</p> : null}

      <button
        type="button"
        disabled={saving}
        onClick={() => saveConsent(consent.marketingTracking)}
        className="mt-3 w-full rounded-xl bg-ink px-3 py-2 text-sm font-bold text-cream disabled:opacity-50"
      >
        {saving ? "저장 중..." : "동의 설정 저장"}
      </button>
    </section>
  );
}
