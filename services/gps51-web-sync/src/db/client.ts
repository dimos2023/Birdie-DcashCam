import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";

let client: SupabaseClient | null = null;

export function getDbClient(config: AppConfig): SupabaseClient {
  if (!client) {
    if (!config.SUPABASE_URL || !config.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase credentials missing");
    }
    client = createClient(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export async function pingSupabase(config: AppConfig): Promise<boolean> {
  const sb = getDbClient(config);
  const { error } = await sb.from("gps51_web_accounts").select("id").limit(1);
  return !error;
}
