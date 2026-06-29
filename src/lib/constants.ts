import type { UserRole } from "@/types/database";
import { MAIN_NAV_ITEMS } from "@/components/layout/nav-config";

export type { NavItem } from "@/components/layout/nav-config";
export { MAIN_NAV_ITEMS, getPageTitle, isNavItemActive } from "@/components/layout/nav-config";

export const BRAND = {
  name: "Birdie Fleet",
  tagline: "Intelligent Fleet Monitoring",
  colors: {
    midnightBlue: "#1C3664",
    blueSky: "#3B8ECC",
    pearlWhite: "#F2F8FC",
    eerieBlack: "#1C1C1C",
  },
} as const;

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Super Admin",
  org_admin: "Organization Admin",
  operator: "Operator",
  viewer: "Viewer",
};

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  super_admin: 4,
  org_admin: 3,
  operator: 2,
  viewer: 1,
};

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

/** @deprecated Use MAIN_NAV_ITEMS from @/components/layout/nav-config */
export const NAV_ITEMS = MAIN_NAV_ITEMS.map((item) => ({
  href: item.href,
  label: item.label,
  icon: item.label,
}));
