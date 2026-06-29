/** Re-exports for backwards compatibility. Prefer @/lib/auth/profile. */
export {
  getCurrentUser,
  getCurrentProfile,
  requireProfile,
  requireAuth,
  requireRole,
  requireOrganizationId,
  getOrganizationId,
  hasRole,
  checkRole,
} from "@/lib/auth/profile";

export { AuthError, ForbiddenError } from "@/lib/auth/errors";
