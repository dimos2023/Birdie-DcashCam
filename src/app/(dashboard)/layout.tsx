import { AppShell } from "@/components/layout/app-shell";
import { DashboardAuthError } from "@/components/auth/dashboard-auth-error";
import { getCurrentProfile, getShellProfile } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Auth is enforced in middleware via supabase.auth.getUser() — no redirects here.
  const dbProfile = await getCurrentProfile();
  const profile = await getShellProfile();

  if (dbProfile && !dbProfile.is_active) {
    return (
      <DashboardAuthError
        title="Account deactivated"
        description="Your account has been deactivated. Contact your organization administrator."
        userEmail={dbProfile.email}
      />
    );
  }

  if (!profile) {
    return <>{children}</>;
  }

  return <AppShell profile={profile}>{children}</AppShell>;
}
