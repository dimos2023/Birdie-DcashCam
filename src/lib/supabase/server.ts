import "server-only";

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type ServerSupabaseClient = SupabaseClient<Database>;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function isCookieWriteError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Cookies can only be modified")
  );
}

/**
 * Shared cookie adapter for @supabase/ssr on the server.
 * Writes succeed in Server Actions and Route Handlers; Server Components are read-only.
 */
export function createServerSupabaseClient(cookieStore: CookieStore): ServerSupabaseClient {
  const { url, anonKey } = getPublicSupabaseConfig();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch (error) {
          if (isCookieWriteError(error)) {
            return;
          }
          console.error("[auth] server setAll cookies failed:", error);
        }
      },
    },
  });
}

/**
 * Supabase client for Server Components, Route Handlers, and Server Actions.
 * Uses cookies from next/headers for session management.
 */
export async function createClient(): Promise<ServerSupabaseClient> {
  const cookieStore = await cookies();
  return createServerSupabaseClient(cookieStore);
}
