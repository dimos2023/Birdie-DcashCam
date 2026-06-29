import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type BrowserSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase client for Client Components (realtime, live updates).
 * Not used for login — authentication is handled by Server Actions.
 * Uses document.cookie via @supabase/ssr (never expose service role key).
 */
export function createClient(): BrowserSupabaseClient {
  const { url, anonKey } = getPublicSupabaseConfig();
  return createBrowserClient<Database>(url, anonKey);
}
