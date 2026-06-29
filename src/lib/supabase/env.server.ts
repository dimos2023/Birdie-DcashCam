import "server-only";

import { z } from "zod";
import { SupabaseConfigError } from "@/lib/supabase/config";

const serviceRoleSchema = z
  .string({ error: "SUPABASE_SERVICE_ROLE_KEY is required" })
  .min(1, "SUPABASE_SERVICE_ROLE_KEY cannot be empty");

/**
 * Returns the Supabase service role key.
 *
 * SECURITY: Server-only. Never import this module in Client Components.
 * The service role bypasses Row Level Security.
 */
export function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    throw new SupabaseConfigError(
      "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (server-only, never use NEXT_PUBLIC_ prefix)."
    );
  }

  const result = serviceRoleSchema.safeParse(key);

  if (!result.success) {
    const detail = result.error.issues.map((issue) => issue.message).join("; ");
    throw new SupabaseConfigError(detail);
  }

  return result.data;
}
