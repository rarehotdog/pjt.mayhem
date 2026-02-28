import { createClient } from "@supabase/supabase-js";

const missingConfigMessage =
  "Supabase is required. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before starting API routes.";

let cached: ReturnType<typeof createClient> | null = null;

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured()) {
    throw new Error(missingConfigMessage);
  }
}

export function getSupabaseAdmin() {
  assertSupabaseConfigured();

  const url = process.env.SUPABASE_URL as string;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  if (!cached) {
    cached = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }

  return cached;
}

export function getSupabaseConfigErrorMessage() {
  return missingConfigMessage;
}
