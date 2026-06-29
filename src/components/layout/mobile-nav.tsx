"use client";

import { BRAND } from "@/lib/constants";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { SidebarNav } from "@/components/layout/sidebar-nav";
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
        className="w-[min(100vw-2rem,18rem)] border-0 bg-[#1C3664] p-0 text-white"
      >
        <SheetHeader className="border-b border-white/10 px-4 py-5 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#3B8ECC]">
              <span className="text-sm font-bold">B</span>
            </div>
            <div>
              <SheetTitle className="text-base font-bold text-white">
                {BRAND.name}
              </SheetTitle>
              <p className="text-[11px] text-[#3B8ECC]">{BRAND.tagline}</p>
            </div>
          </div>
        </SheetHeader>
        <div className="flex h-[calc(100%-5.5rem)] flex-col">
          <SidebarNav
            profile={profile}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
