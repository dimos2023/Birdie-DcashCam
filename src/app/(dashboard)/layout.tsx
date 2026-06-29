import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { GUEST_PROFILE } from "@/lib/auth/guest-profile";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = (await getCurrentProfile()) ?? GUEST_PROFILE;

  return <AppShell profile={profile}>{children}</AppShell>;
}
