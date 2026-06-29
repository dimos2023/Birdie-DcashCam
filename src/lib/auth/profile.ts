import "server-only";

import type { Profile, UserRole } from "@/lib/types";
import { hasPermission } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { AuthError, ForbiddenError } from "@/lib/auth/errors";

export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    console.error("[auth] getUser failed:", error.message);
    return null;
  }
  return user;
}

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) {
    console.error(
      "[auth] profile fetch failed:",
      error.message,
      "code:",
      error.code,
      "userId:",
      user.id
    );
    return null;
  }
  return data;
}

/** Returns the authenticated profile or throws AuthError. */
export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) {
    throw new AuthError("You must be signed in to perform this action.");
  }
  if (!profile.is_active) {
    throw new AuthError("Your account has been deactivated.");
  }
  return profile;
}

/** Alias for requireProfile — backwards compatible. */
export async function requireAuth(): Promise<Profile> {
  return requireProfile();
}

export function checkRole(profile: Profile, minRole: UserRole): boolean {
  return hasPermission(profile.role, minRole);
}

export async function hasRole(minRole: UserRole): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile?.is_active) return false;
  return checkRole(profile, minRole);
}

/** Returns profile if user meets minimum role, otherwise throws ForbiddenError. */
export async function requireRole(minRole: UserRole): Promise<Profile> {
  const profile = await requireProfile();
  if (!checkRole(profile, minRole)) {
    throw new ForbiddenError(
      `This action requires ${minRole.replace("_", " ")} access or higher.`
    );
  }
  return profile;
}

export async function getOrganizationId(): Promise<string | null> {
  const profile = await getCurrentProfile();
  return profile?.organization_id ?? null;
}

export async function requireOrganizationId(): Promise<string> {
  const profile = await requireProfile();
  return profile.organization_id;
}
