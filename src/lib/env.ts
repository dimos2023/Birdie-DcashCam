import "server-only";

export {
  getPublicSupabaseConfig,
  getServiceRoleKey,
  SupabaseConfigError,
} from "@/lib/supabase/config";

export { getServerEnv, getWhatsAppConfig, getGoogleMapsApiKey } from "@/lib/env.server";
