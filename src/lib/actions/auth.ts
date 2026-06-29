"use server";

import { requireProfile } from "@/lib/auth/profile";
import type { Profile } from "@/lib/types";

/**
 * Ensures the caller is authenticated before running a server action mutation.
 * Returns the active profile scoped to their organization (RLS applies).
 */
export async function withAuth(): Promise<Profile> {
  return requireProfile();
}
