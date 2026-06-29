import type { Profile } from "@/lib/types";

/** Fallback profile when auth is not used as a gatekeeper. */
export const GUEST_PROFILE: Profile = {
  id: "00000000-0000-0000-0000-000000000000",
  organization_id: "00000000-0000-0000-0000-000000000001",
  email: "guest@birdie.local",
  full_name: "Guest User",
  avatar_url: null,
  role: "viewer",
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};
