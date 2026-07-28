// ─── Role ↔ Permission Mapping ────────────────────────────────────────────────
//
// This is the single source of truth for what each role can do.
// To add a new role or change access, edit only this file.
// Never perform `role === 'SOME_ROLE'` checks in components or routes.
//

import type { UserRole } from '@/types/auth';
import { PERMISSIONS, type Permission } from '@/permissions/permissions';

// ─── Role permission map ──────────────────────────────────────────────────────

/**
 * Defines the full set of permissions granted to each role.
 * The `satisfies` clause ensures every UserRole is listed here.
 */
const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SECRETARY: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_DOCUMENT_REQUESTS,
    PERMISSIONS.VIEW_SCHEDULE_REQUESTS,
    PERMISSIONS.VIEW_CALENDAR,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.MANAGE_MASS_SCHEDULE,
    PERMISSIONS.MANAGE_MY_AVAILABILITY,
    PERMISSIONS.MANAGE_PARISH_SETTINGS,
  ],

  PRIEST: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_DOCUMENT_REQUESTS,
    PERMISSIONS.VIEW_SCHEDULE_REQUESTS,
    PERMISSIONS.VIEW_CALENDAR,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.MANAGE_MY_AVAILABILITY,
  ],

  DIOCESE_COORDINATOR: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_DOCUMENT_REQUESTS,
    PERMISSIONS.VIEW_SCHEDULE_REQUESTS,
    PERMISSIONS.VIEW_CALENDAR,
    PERMISSIONS.VIEW_NOTIFICATIONS,
    PERMISSIONS.VIEW_ANALYTICS,
    PERMISSIONS.MANAGE_PARISHES,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.VIEW_ACTIVITY_LOG,
    PERMISSIONS.MANAGE_MY_AVAILABILITY,
    PERMISSIONS.MANAGE_PARISH_SETTINGS,
  ],

  // Parishioners do not have access to the admin portal.
  PARISHIONER: [],
} satisfies Record<UserRole, readonly Permission[]>;

// ─── Core helper ─────────────────────────────────────────────────────────────

/**
 * Returns true if `role` has been granted `permission`.
 * Accepts `null` as a role so callers don't need to null-guard.
 */
export function hasPermission(
  role: UserRole | null | undefined,
  permission: Permission
): boolean {
  if (!role) return false;
  return (ROLE_PERMISSIONS[role] as readonly Permission[]).includes(permission);
}

// ─── Named navigation guards ──────────────────────────────────────────────────
// Prefer these over calling hasPermission() directly in components so that
// the intent is self-documenting and refactoring is contained here.

/** True when the role may view the Analytics module. */
export function canViewAnalytics(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.VIEW_ANALYTICS);
}

/** True when the role may manage (add / edit / archive) parishes. */
export function canManageParishes(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_PARISHES);
}

/** True when the role may manage (add / edit / disable) users. */
export function canManageUsers(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_USERS);
}

/** True when the role may view the Activity Log. */
export function canViewActivityLog(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.VIEW_ACTIVITY_LOG);
}

/** True when the role may manage Mass schedules. */
export function canManageMassSchedule(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_MASS_SCHEDULE);
}

/** True when the role may manage their availability / leave. */
export function canManageMyAvailability(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_MY_AVAILABILITY);
}

/** True when the role may manage parish settings. */
export function canManageParishSettings(role: UserRole | null | undefined): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_PARISH_SETTINGS);
}

// Re-export Permission type for convenient single-import by consumers.
export type { Permission };
export { ROLE_PERMISSIONS };
