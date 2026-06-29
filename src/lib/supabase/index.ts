/**
 * Supabase client factories for the Birdie Fleet platform.
 *
 * | Export              | Environment | RLS   | Use in                |
 * |---------------------|-------------|-------|-----------------------|
 * | createClient (client) | Browser   | Yes   | Client Components     |
 * | createClient (server) | Server    | Yes   | Server Actions, RSC   |
 * | createAdminClient     | Server    | No    | Webhooks, system jobs |
 */
export { createClient as createBrowserClient } from "./client";
export type { BrowserSupabaseClient } from "./client";

export { createClient as createServerClient } from "./server";
export type { ServerSupabaseClient } from "./server";

export { createAdminClient } from "./admin";
export type { AdminSupabaseClient } from "./admin";

export {
  getPublicSupabaseConfig,
  SupabaseConfigError,
  type PublicSupabaseConfig,
} from "./config";

export { updateSession } from "./middleware";
