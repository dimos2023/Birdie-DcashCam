import { getPublicSupabaseConfig } from "@/lib/supabase/config";

/** @deprecated Use getPublicSupabaseConfig from @/lib/supabase/config */
export function getClientSupabaseConfig() {
  return getPublicSupabaseConfig();
}

/** Injected from GOOGLE_MAPS_API_KEY via next.config.ts at build time. */
export function getClientGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
}
