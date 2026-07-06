import { createClient } from "@supabase/supabase-js";
let client = null;
export function getDbClient(config) {
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
export async function pingSupabase(config) {
    const sb = getDbClient(config);
    const { error } = await sb.from("gps51_web_accounts").select("id").limit(1);
    return !error;
}
