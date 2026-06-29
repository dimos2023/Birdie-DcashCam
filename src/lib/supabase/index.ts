/**
 * Supabase client factories for the Birdie Fleet platform.
 *
 * | Export                  | Environment | RLS | Use in                    |
 * |-------------------------|-------------|-----|---------------------------|
 * | createBrowserClient     | Browser     | Yes | Client Components         |
 * | createServerClient      | Server      | Yes | RSC, Route Handlers, Actions |
 * | createAdminClient       | Server      | No  | Webhooks, system jobs     |
 */
export { createClient as createBrowserClient } from "./client";
export type { BrowserSupabaseClient } from "./client";

export { createClient as createServerClient } from "./server";
export type { ServerSupabaseClient } from "./server";

export { createAdminClient } from "./admin";
export type { AdminSupabaseClient } from "./admin";

export {
  getPublicSupabaseConfig,
  getServiceRoleKey,
  SupabaseConfigError,
  type PublicSupabaseConfig,
} from "./config";
