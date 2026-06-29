import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { DashboardAuthError } from "@/components/auth/dashboard-auth-error";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";
import type { Profile, UserRole } from "@/lib/types";

const ALLOWED_ROLES: UserRole[] = [
  "super_admin",
  "org_admin",
  "operator",
  "viewer",
];

type ProfileWithOptionalStatus = Profile & {
  status?: string | null;
};

function isProfileDeactivated(profile: ProfileWithOptionalStatus): boolean {
  if (profile.status === "inactive") {
    return true;
  }
  if (profile.is_active === false) {
    return true;
  }
  return false;
}

function hasAllowedRole(role: UserRole): boolean {
  return ALLOWED_ROLES.includes(role);
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <DashboardAuthError
        title="Profile setup required"
        description="Your account is signed in but does not have an organization profile yet."
        userEmail={user.email}
        detail='Ask an admin to create your profile in Supabase, or sign up with user metadata: { "organization_id": "...", "full_name": "...", "role": "org_admin" }'
      />
    );
  }

  if (isProfileDeactivated(profile)) {
    return (
      <DashboardAuthError
        title="Account deactivated"
        description="Your account has been deactivated. Contact your organization administrator."
        userEmail={profile.email}
      />
    );
  }

  if (!hasAllowedRole(profile.role)) {
    return (
      <DashboardAuthError
        title="Access not permitted"
        description="Your profile role is not authorized to access the dashboard."
        userEmail={profile.email}
        detail={`Current role: ${profile.role}`}
      />
    );
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
