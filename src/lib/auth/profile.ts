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

/** Profile for shell UI — DB row when present, otherwise derived from auth user metadata. */
export async function getShellProfile(): Promise<Profile | null> {
  const profile = await getCurrentProfile();
  if (profile) return profile;

  const user = await getCurrentUser();
  if (!user) return null;

  const meta = user.user_metadata ?? {};
  const now = new Date().toISOString();

  return {
    id: user.id,
    organization_id: (meta.organization_id as string) ?? "",
    email: user.email ?? "",
    full_name: (meta.full_name as string) ?? user.email ?? "User",
    avatar_url: null,
    role: (meta.role as UserRole) ?? "viewer",
    is_active: true,
    created_at: user.created_at,
    updated_at: now,
  };
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
