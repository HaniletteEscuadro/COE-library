import type { UserRole } from "@/lib/enums";

export const ADMIN_ROLES = ["ADMIN", "REGISTRAR"] satisfies UserRole[];
export const LIBRARY_ROLES = ["ADMIN", "LIBRARIAN"] satisfies UserRole[];
export const ACADEMIC_STAFF_ROLES = ["ADMIN", "REGISTRAR", "FACULTY"] satisfies UserRole[];
export const STUDENT_PORTAL_ROLES = ["ADMIN", "REGISTRAR", "FACULTY", "STUDENT"] satisfies UserRole[];

/**
 * Only a full ADMIN may change roles or delete accounts. REGISTRAR can read the
 * admin dashboard but must not be able to escalate itself to ADMIN.
 */
export const SUPER_ADMIN_ROLES = ["ADMIN"] satisfies UserRole[];

/**
 * `role` is typed `string` at the call sites because the DB column is a plain
 * string (SQLite has no enums), so this widens rather than narrows.
 */
export function hasRole(role: string | undefined | null, allowed: readonly UserRole[]) {
  return Boolean(role && (allowed as readonly string[]).includes(role));
}

/** Full administrators only — role changes, deletions, destructive actions. */
export function isSuperAdmin(role: string | undefined | null) {
  return hasRole(role, SUPER_ADMIN_ROLES);
}

export function canManageAcademics(role: string | undefined | null) {
  return hasRole(role, ACADEMIC_STAFF_ROLES);
}

export function canManageLibrary(role: string | undefined | null) {
  return hasRole(role, LIBRARY_ROLES);
}

export function canViewAdmin(role: string | undefined | null) {
  return hasRole(role, ADMIN_ROLES);
}

export function formatRole(role: string) {
  return role
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
