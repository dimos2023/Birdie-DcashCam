export { getPublicSupabaseConfig } from "@/lib/supabase/config";

/** Injected from GOOGLE_MAPS_API_KEY via next.config.ts at build time. */
export function getClientGoogleMapsApiKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
}
