import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type ServerSupabaseClient = SupabaseClient<Database>;

/**
 * Creates a Supabase client for Server Components, Route Handlers, and Server Actions.
 *
 * Reads the auth session from HTTP cookies and forwards cookie updates on sign-in/out.
 * Uses the anon key only — RLS policies apply to every query.
 */
export async function createClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from a Server Component — cookie writes are handled by middleware.
        }
      },
    },
  });
}
