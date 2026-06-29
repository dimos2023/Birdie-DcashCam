import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { getServiceRoleKey } from "@/lib/supabase/env.server";

export type AdminSupabaseClient = SupabaseClient<Database>;

/**
 * Creates a Supabase admin client that bypasses Row Level Security.
 *
 * SECURITY:
 * - This module is server-only (`import "server-only"`).
 * - Never import `createAdminClient` in Client Components or any file with `"use client"`.
 * - Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
 *
 * Use only for trusted server-side operations (webhooks, background jobs, migrations).
 * For user-facing operations, use `createClient` from `./server` instead.
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
