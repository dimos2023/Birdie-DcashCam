import "server-only";

import { getCurrentProfile } from "@/lib/auth/profile";
import { DEFAULT_ORGANIZATION_ID } from "@/lib/constants/organization";

export async function getActionContext() {
  const profile = await getCurrentProfile();

  return {
    organizationId: profile?.organization_id ?? DEFAULT_ORGANIZATION_ID,
    userId: profile?.id ?? null,
  };
}
