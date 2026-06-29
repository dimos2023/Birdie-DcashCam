import "server-only";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { getServiceRoleKey } from "@/lib/supabase/env.server";

/** @deprecated Use getPublicSupabaseConfig from @/lib/supabase/config */
export function getSupabasePublicConfig() {
  return getPublicSupabaseConfig();
}

export { getServiceRoleKey };

// Re-export for non-Supabase server env used elsewhere in the app
export { getServerEnv, getWhatsAppConfig, getGoogleMapsApiKey } from "@/lib/env.server";
