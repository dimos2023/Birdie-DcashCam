import type { UserRole } from "@/lib/types";
import { ROLE_HIERARCHY } from "@/lib/constants";

export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole];
}

export function isAtLeastOperator(role: UserRole): boolean {
  return hasPermission(role, "operator");
}

export function isOrgAdmin(role: UserRole): boolean {
  return hasPermission(role, "org_admin");
}

export function canManageUsers(role: UserRole): boolean {
  return hasPermission(role, "org_admin");
}

export function canWriteFleetData(role: UserRole): boolean {
  return hasPermission(role, "operator");
}

export function isReadOnly(role: UserRole): boolean {
  return role === "viewer";
}
