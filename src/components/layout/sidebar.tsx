"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import type { Profile } from "@/lib/types";

interface SidebarProps {
  profile: Profile;
}

export function Sidebar({ profile }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "hidden h-screen flex-col bg-[#1C3664] text-white transition-all duration-300 lg:flex",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className="flex h-16 items-center justify-between border-b border-white/10 px-4">
        {!collapsed ? (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#3B8ECC]">
                <span className="text-sm font-bold">B</span>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-bold tracking-tight">{BRAND.name}</p>
                <p className="truncate text-[10px] text-[#3B8ECC]">{BRAND.tagline}</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#3B8ECC]">
            <span className="text-sm font-bold">B</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon-sm"
          className={cn("shrink-0 text-white/70 hover:bg-white/10 hover:text-white", collapsed && "mx-auto")}
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      <SidebarNav profile={profile} collapsed={collapsed} />
    </aside>
  );
}
