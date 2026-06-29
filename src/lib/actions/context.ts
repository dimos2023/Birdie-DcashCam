import "server-only";

import { getCurrentProfile } from "@/lib/auth/profile";
import { GUEST_PROFILE } from "@/lib/auth/guest-profile";

export async function getActionContext() {
  const profile = await getCurrentProfile();

  return {
    organizationId: profile?.organization_id ?? GUEST_PROFILE.organization_id,
    userId: profile?.id ?? null,
  };
}
