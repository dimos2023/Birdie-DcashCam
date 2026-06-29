"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, LogOut, Menu, Search } from "lucide-react";
import { BRAND } from "@/lib/constants";
import { getPageTitle } from "@/components/layout/nav-config";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { LinkButton } from "@/components/ui/link-button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLE_LABELS } from "@/lib/constants";
import type { Profile } from "@/lib/types";

interface TopbarProps {
  profile: Profile;
}

export function Topbar({ profile }: TopbarProps) {
  const pathname = usePathname();
  const title = getPageTitle(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);

  const initials = profile.full_name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-[#e8f2fa] bg-white/95 px-4 backdrop-blur-sm lg:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 text-[#1C3664] hover:bg-[#F2F8FC] lg:hidden"
          onClick={() => setMobileOpen(true)}
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-[#1C3664] lg:text-xl">
            {title}
          </h1>
          <p className="hidden text-xs text-[#1C1C1C]/50 sm:block">
            {BRAND.tagline}
          </p>
        </div>

        <div className="hidden max-w-sm flex-1 lg:block">
          <div className="relative">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[#1C1C1C]/35" />
            <Input
              placeholder="Search fleet, vehicles, customers..."
              className="h-9 border-[#d4e4f0] bg-[#F2F8FC] pl-9 text-sm text-[#1C1C1C] placeholder:text-[#1C1C1C]/35 focus-visible:border-[#3B8ECC] focus-visible:ring-[#3B8ECC]/20"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="text-[#1C3664] hover:bg-[#F2F8FC]"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
          </Button>

          <Separator orientation="vertical" className="mx-1 hidden h-6 md:block" />

          <LinkButton
            href="/logout"
            variant="outline"
            size="sm"
            className="hidden border-[#d4e4f0] text-[#1C3664] hover:border-[#3B8ECC]/40 hover:bg-[#F2F8FC] md:inline-flex"
          >
            <LogOut className="mr-1.5 h-4 w-4" />
            Logout
          </LinkButton>

          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="rounded-full outline-none ring-[#3B8ECC] focus-visible:ring-2"
                  aria-label="User menu"
                />
              }
            >
              <Avatar className="h-9 w-9 border-2 border-[#3B8ECC]/25 shadow-sm">
                <AvatarFallback className="bg-[#1C3664] text-xs font-semibold text-white">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="font-normal">
                <p className="font-semibold text-[#1C3664]">{profile.full_name}</p>
                <p className="text-xs text-muted-foreground">{profile.email}</p>
                <p className="mt-0.5 text-xs text-[#3B8ECC]">
                  {ROLE_LABELS[profile.role]}
                </p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link href="/settings" className="w-full">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                <Link
                  href="/logout"
                  className="flex w-full items-center text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <MobileNav profile={profile} open={mobileOpen} onOpenChange={setMobileOpen} />
    </>
  );
}
