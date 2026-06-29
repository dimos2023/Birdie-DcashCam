import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig, getServiceRoleKey } from "@/lib/supabase/config";

export type AdminSupabaseClient = SupabaseClient<Database>;

/**
 * Supabase admin client — bypasses Row Level Security.
 *
 * SECURITY:
 * - Server-only (`import "server-only"`).
 * - Never import in Client Components or `"use client"` modules.
 * - Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 *
 * Use for trusted server operations (webhooks, background jobs).
 * For user-facing requests, use `createClient` from `./server`.
 */
export function createAdminClient(): AdminSupabaseClient {
  const { url } = getPublicSupabaseConfig();
  const serviceRoleKey = getServiceRoleKey();

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
