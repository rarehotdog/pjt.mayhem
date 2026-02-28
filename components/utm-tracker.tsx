"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";

import { trackClientEvent } from "@/lib/client-telemetry";

const KEYS = [
  "campaign_id",
  "click_source",
  "partition",
  "ua_creative_topic",
  "utm_source",
  "source",
  "mode"
] as const;

export function UTMTracker() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const params: Record<string, string> = {};

    KEYS.forEach((key) => {
      const value = searchParams.get(key);
      if (value) {
        params[key] = value;
      }
    });

    if (Object.keys(params).length > 0) {
      localStorage.setItem("us_utm", JSON.stringify(params));
      trackClientEvent({
        eventName: "attribution_captured",
        eventType: "system",
        pagePath: window.location.pathname,
        payload: params
      });
    }
  }, [searchParams]);

  return null;
}
