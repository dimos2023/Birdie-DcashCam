import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Car,
  Cpu,
  Radio,
  MessageCircle,
  BarChart3,
  Settings,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match child paths (e.g. /vehicles/123/live) */
  matchChildPaths?: boolean;
};

export const MAIN_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users, matchChildPaths: true },
  { href: "/vehicles", label: "Vehicles", icon: Car, matchChildPaths: true },
  { href: "/devices", label: "Devices", icon: Cpu, matchChildPaths: true },
  { href: "/live-monitoring", label: "Live Monitoring", icon: Radio, matchChildPaths: true },
  { href: "/whatsapp", label: "WhatsApp", icon: MessageCircle },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings, matchChildPaths: true },
];

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  if (pathname === item.href) return true;
  if (!item.matchChildPaths) return false;
  return pathname.startsWith(`${item.href}/`);
}

export function getPageTitle(pathname: string): string {
  const match = MAIN_NAV_ITEMS.find((item) => isNavItemActive(pathname, item));
  if (match) return match.label;
  if (pathname.includes("/live")) return "Live Monitoring";
  if (pathname.startsWith("/settings")) return "Settings";
  return "Dashboard";
}
