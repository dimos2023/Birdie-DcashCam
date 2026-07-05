import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";

let client: SupabaseClient | null = null;

export function getSupabaseAdmin(config: AppConfig): SupabaseClient {
  if (!client) {
    client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function pingSupabase(config: AppConfig): Promise<boolean> {
  const sb = getSupabaseAdmin(config);
  const { error } = await sb.from("jt_gateway_instances").select("id").limit(1);
  return !error;
}
