import { type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfig } from "../config.js";
export declare function getDbClient(config: AppConfig): SupabaseClient;
export declare function pingSupabase(config: AppConfig): Promise<boolean>;
