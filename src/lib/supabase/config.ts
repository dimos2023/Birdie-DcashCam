import { z } from "zod";

const publicSupabaseSchema = z.object({
  url: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_URL is required" })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  anonKey: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" })
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY cannot be empty"),
});

const serviceRoleKeySchema = z
  .string({ error: "SUPABASE_SERVICE_ROLE_KEY is required" })
  .min(1, "SUPABASE_SERVICE_ROLE_KEY cannot be empty");

export type PublicSupabaseConfig = z.infer<typeof publicSupabaseSchema>;

/** Thrown when required Supabase environment variables are missing or invalid. */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

function formatZodError(error: z.ZodError): string {
  return error.issues.map((issue) => issue.message).join("; ");
}

/**
 * Validates and returns public Supabase credentials.
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * Safe to use in browser and server contexts.
 */
export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const result = publicSupabaseSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    throw new SupabaseConfigError(
      formatZodError(result.error) ||
        "Missing Supabase configuration. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
    );
  }

  return result.data;
}

/**
 * Validates and returns the Supabase service role key.
 * Reads SUPABASE_SERVICE_ROLE_KEY (server-only — never prefix with NEXT_PUBLIC_).
 *
 * Call only from server-side code (Route Handlers, Server Actions, admin client).
 */
export function getServiceRoleKey(): string {
  const result = serviceRoleKeySchema.safeParse(process.env.SUPABASE_SERVICE_ROLE_KEY);

  if (!result.success) {
    throw new SupabaseConfigError(
      formatZodError(result.error) ||
        "SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local (server-only)."
    );
  }

  return result.data;
}
