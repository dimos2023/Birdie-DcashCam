"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { BRAND } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
        "hidden h-screen flex-col bg-[#1C3664] text-white shadow-xl shadow-[#1C3664]/20 transition-all duration-300 lg:flex",
        collapsed ? "w-[72px]" : "w-64"
      )}
    >
      {/* Brand header */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-white/10",
          collapsed ? "justify-center px-2" : "justify-between px-4"
        )}
      >
        {!collapsed ? (
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#3B8ECC] shadow-md shadow-[#3B8ECC]/30">
              <span className="text-sm font-bold">B</span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold tracking-tight">
                {BRAND.name}
              </p>
              <p className="truncate text-[10px] font-medium text-[#3B8ECC]">
                Fleet Platform
              </p>
            </div>
          </div>
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#3B8ECC] shadow-md shadow-[#3B8ECC]/30">
            <span className="text-sm font-bold">B</span>
          </div>
        )}

        {!collapsed && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-white/60 hover:bg-white/10 hover:text-white"
            onClick={() => setCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        )}
      </div>

      {collapsed && (
        <div className="flex justify-center border-b border-white/10 py-2">
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-white/60 hover:bg-white/10 hover:text-white"
                  onClick={() => setCollapsed(false)}
                  aria-label="Expand sidebar"
                />
              }
            >
              <ChevronRight className="h-4 w-4" />
            </TooltipTrigger>
            <TooltipContent side="right">Expand sidebar</TooltipContent>
          </Tooltip>
        </div>
      )}

      {/* Navigation + profile */}
      <SidebarNav profile={profile} collapsed={collapsed} />

      {/* Logout */}
      <div className="shrink-0 border-t border-white/10 p-3">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger
              render={
                <Link
                  href="/logout"
                  className="flex h-10 w-full items-center justify-center rounded-xl text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Logout"
                />
              }
            >
              <LogOut className="h-5 w-5" />
            </TooltipTrigger>
            <TooltipContent side="right">Logout</TooltipContent>
          </Tooltip>
        ) : (
          <LinkButton
            href="/logout"
            variant="ghost"
            className="h-10 w-full justify-start gap-3 rounded-xl px-3 text-white/75 hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-5 w-5 shrink-0" />
            Logout
          </LinkButton>
        )}
      </div>
    </aside>
  );
}
