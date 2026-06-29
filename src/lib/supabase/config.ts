import { z } from "zod";

const publicSupabaseSchema = z.object({
  url: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_URL is required" })
    .url("NEXT_PUBLIC_SUPABASE_URL must be a valid URL"),
  anonKey: z
    .string({ error: "NEXT_PUBLIC_SUPABASE_ANON_KEY is required" })
    .min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY cannot be empty"),
});

export type PublicSupabaseConfig = z.infer<typeof publicSupabaseSchema>;

/** Thrown when required Supabase environment variables are missing or invalid. */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

/**
 * Validates and returns public Supabase credentials.
 * Safe to use in both browser and server contexts.
 */
export function getPublicSupabaseConfig(): PublicSupabaseConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url && !anonKey) {
    throw new SupabaseConfigError(
      "Missing Supabase configuration. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local"
    );
  }

  const result = publicSupabaseSchema.safeParse({ url, anonKey });

  if (!result.success) {
    const detail = result.error.issues.map((issue) => issue.message).join("; ");
    throw new SupabaseConfigError(detail);
  }

  return result.data;
}
