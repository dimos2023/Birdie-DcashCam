import { AppShell } from "@/components/layout/app-shell";
import { DashboardAuthError } from "@/components/auth/dashboard-auth-error";
import { getCurrentProfile, getCurrentUser } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session is enforced in middleware — never redirect to /login from here.
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardAuthError
        title="Session not found"
        description="Your session could not be verified on the server."
        detail="If this keeps happening, sign out, clear site cookies, and sign in again."
      />
    );
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
