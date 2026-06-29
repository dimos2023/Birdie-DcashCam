import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type BrowserSupabaseClient = SupabaseClient<Database>;

let browserClient: BrowserSupabaseClient | undefined;

/**
 * Supabase client for Client Components.
 * Uses NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * All queries are scoped by Row Level Security.
 */
export function createClient(): BrowserSupabaseClient {
  if (browserClient) {
    return browserClient;
  }

  const { url, anonKey } = getPublicSupabaseConfig();
  browserClient = createBrowserClient<Database>(url, anonKey);
  return browserClient;
}
