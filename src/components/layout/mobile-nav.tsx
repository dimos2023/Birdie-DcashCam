"use client";

import { LogOut } from "lucide-react";
import { BRAND } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { LinkButton } from "@/components/ui/link-button";
import type { Profile } from "@/lib/types";

interface MobileNavProps {
  profile: Profile;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ profile, open, onOpenChange }: MobileNavProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[min(100vw-2rem,280px)] flex-col border-0 bg-[#1C3664] p-0 text-white"
      >
        <SheetHeader className="shrink-0 border-b border-white/10 px-5 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#3B8ECC] shadow-md shadow-[#3B8ECC]/30">
              <span className="text-base font-bold">B</span>
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-white">
                {BRAND.name}
              </SheetTitle>
              <p className="text-[11px] font-medium text-[#3B8ECC]">
                Fleet Platform
              </p>
            </div>
          </div>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <SidebarNav
            profile={profile}
            onNavigate={() => onOpenChange(false)}
          />
        </div>

        <div className="shrink-0 border-t border-white/10 p-4">
          <LinkButton
            href="/logout"
            variant="ghost"
            className="h-10 w-full justify-start gap-3 rounded-xl text-white/80 hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            <LogOut className="h-5 w-5" />
            Logout
          </LinkButton>
        </div>
      </SheetContent>
    </Sheet>
  );
}
