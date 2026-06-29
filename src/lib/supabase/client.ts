import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type BrowserSupabaseClient = SupabaseClient<Database>;

/**
 * Creates a Supabase client for use in Client Components.
 *
 * Uses only the public anon key — never the service role key.
 * All queries are scoped by Row Level Security policies.
 */
export function createClient(): BrowserSupabaseClient {
  const { url, anonKey } = getPublicSupabaseConfig();

  return createBrowserClient<Database>(url, anonKey);
}
