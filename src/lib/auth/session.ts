/** Re-exports for backwards compatibility. Prefer @/lib/auth/profile. */
export {
  getCurrentUser,
  getCurrentProfile,
  getShellProfile,
  requireProfile,
  requireAuth,
  requireRole,
  requireOrganizationId,
  getOrganizationId,
  hasRole,
  checkRole,
} from "@/lib/auth/profile";

export { AuthError, ForbiddenError } from "@/lib/auth/errors";
