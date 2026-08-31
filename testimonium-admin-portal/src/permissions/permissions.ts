// ─── Permission Definitions ───────────────────────────────────────────────────
//
// Every gated feature in the application must be expressed as a named
// Permission here. Components, routes, and nav items reference these
// constants — never raw role strings — so adding or changing permissions
// stays in a single place.
//

/** All named permissions available in the system. */
export type Permission =
  | 'VIEW_DASHBOARD'
  | 'VIEW_DOCUMENT_REQUESTS'
  | 'VIEW_SCHEDULE_REQUESTS'
  | 'VIEW_CALENDAR'
  | 'VIEW_NOTIFICATIONS'
  | 'VIEW_ANALYTICS'
  | 'MANAGE_REPORTS'
  | 'MANAGE_PARISHES'
  | 'MANAGE_USERS'
  | 'VIEW_ACTIVITY_LOG'
  | 'MANAGE_MASS_SCHEDULE'
  | 'MANAGE_MY_AVAILABILITY'
  | 'MANAGE_PARISH_SETTINGS'
  | 'MANAGE_MAP_CONFIG';

// ─── Convenience constants ────────────────────────────────────────────────────
// Re-export each permission as a constant so callers can write
//   PERMISSIONS.VIEW_ANALYTICS
// instead of the raw string literal, which prevents typos.

export const PERMISSIONS = {
  VIEW_DASHBOARD: 'VIEW_DASHBOARD' as const,
  VIEW_DOCUMENT_REQUESTS: 'VIEW_DOCUMENT_REQUESTS' as const,
  VIEW_SCHEDULE_REQUESTS: 'VIEW_SCHEDULE_REQUESTS' as const,
  VIEW_CALENDAR: 'VIEW_CALENDAR' as const,
  VIEW_NOTIFICATIONS: 'VIEW_NOTIFICATIONS' as const,
  VIEW_ANALYTICS: 'VIEW_ANALYTICS' as const,
  MANAGE_REPORTS: 'MANAGE_REPORTS' as const,
  MANAGE_PARISHES: 'MANAGE_PARISHES' as const,
  MANAGE_USERS: 'MANAGE_USERS' as const,
  VIEW_ACTIVITY_LOG: 'VIEW_ACTIVITY_LOG' as const,
  MANAGE_MASS_SCHEDULE: 'MANAGE_MASS_SCHEDULE' as const,
  MANAGE_MY_AVAILABILITY: 'MANAGE_MY_AVAILABILITY' as const,
  MANAGE_PARISH_SETTINGS: 'MANAGE_PARISH_SETTINGS' as const,
  MANAGE_MAP_CONFIG: 'MANAGE_MAP_CONFIG' as const,
} satisfies Record<Permission, Permission>;
