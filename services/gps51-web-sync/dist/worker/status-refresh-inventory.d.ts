import type { SupabaseClient } from "@supabase/supabase-js";
export declare function loadInventoryIdsForRefresh(sb: SupabaseClient, accountId: string): Promise<Set<string>>;
