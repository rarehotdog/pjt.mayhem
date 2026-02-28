"use client";

import { useEffect } from "react";

import { trackClientEvent } from "@/lib/client-telemetry";
import type { TelemetryEventType } from "@/lib/types";

interface PageEventTrackerProps {
  eventName: string;
  eventType?: TelemetryEventType;
  payload?: Record<string, unknown>;
}

export function PageEventTracker({ eventName, eventType = "product", payload }: PageEventTrackerProps) {
  useEffect(() => {
    trackClientEvent({
      eventName,
      eventType,
      pagePath: window.location.pathname,
      payload
    });
  }, [eventName, eventType, payload]);

  return null;
}
