import { NextResponse } from "next/server";

import { assertSupabaseConfigured, getSupabaseConfigErrorMessage } from "@/lib/supabase";

export function ok<T extends Record<string, unknown>>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function fail(message: string, status = 400, details?: unknown) {
  return NextResponse.json(
    {
      error: message,
      details
    },
    { status }
  );
}

export function ensureSupabaseOrFail() {
  try {
    assertSupabaseConfigured();
    return null;
  } catch {
    return fail(getSupabaseConfigErrorMessage(), 503);
  }
}
