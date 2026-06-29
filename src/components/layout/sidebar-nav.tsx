"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isNavItemActive, MAIN_NAV_ITEMS } from "@/components/layout/nav-config";
import type { Profile } from "@/lib/types";
import { ROLE_LABELS } from "@/lib/constants";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface SidebarNavProps {
  profile: Profile;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({ profile, collapsed = false, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {MAIN_NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(pathname, item);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                isActive
                  ? "bg-[#3B8ECC] text-white shadow-md shadow-[#3B8ECC]/25"
                  : "text-white/75 hover:bg-white/10 hover:text-white"
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5 shrink-0",
                  isActive ? "text-white" : "text-white/60 group-hover:text-white"
                )}
              />
              {!collapsed && <span>{item.label}</span>}
              {isActive && !collapsed && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div
          className={cn(
            "flex items-center gap-3 rounded-xl bg-white/5 p-3",
            collapsed && "justify-center p-2"
          )}
        >
          <Avatar className="h-9 w-9 shrink-0 border border-[#3B8ECC]/40">
            <AvatarFallback className="bg-[#3B8ECC] text-xs font-semibold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{profile.full_name}</p>
              <p className="truncate text-xs text-white/50">{ROLE_LABELS[profile.role]}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
