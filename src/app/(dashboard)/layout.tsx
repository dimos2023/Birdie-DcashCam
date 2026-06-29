import { AppShell } from "@/components/layout/app-shell";
import { DashboardAuthError } from "@/components/auth/dashboard-auth-error";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const profile = await getCurrentProfile();

  // Session is enforced by middleware — do not redirect to /login here (causes loops).
  if (!user) {
    return (
      <DashboardAuthError
        title="Session not found"
        description="Your session could not be verified. Please sign in again."
        detail="If this keeps happening, clear cookies for this site and try again."
      />
    );
  }

  if (!profile) {
    return (
      <DashboardAuthError
        title="Profile not set up"
        description="Your account is authenticated but has no organization profile yet."
        userEmail={user.email}
        detail='Ask an admin to create your profile in Supabase, or sign up with user metadata: { "organization_id": "...", "full_name": "...", "role": "org_admin" }'
      />
    );
  }

  if (!profile.is_active) {
    return (
      <DashboardAuthError
        title="Account deactivated"
        description="Your account has been deactivated. Contact your organization administrator."
        userEmail={profile.email}
      />
    );
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
