import type { Profile } from "@/lib/types";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

interface AppShellProps {
  children: React.ReactNode;
  profile: Profile;
}

export function AppShell({ children, profile }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-[#F2F8FC]">
      <Sidebar profile={profile} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar profile={profile} />
        <main className="flex-1 overflow-y-auto bg-white lg:rounded-tl-2xl lg:border-t lg:border-l lg:border-[#e8f2fa]">
          {children}
        </main>
      </div>
    </div>
  );
}
