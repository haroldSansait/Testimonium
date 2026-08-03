/**
 * Session Security Configuration for TESTIMONIUM Admin Portal
 * Reads environment variables with safe defaults.
 */

export const SESSION_CONFIG = {
  /** Minutes of inactivity before warning modal is displayed (default: 25 mins) */
  SESSION_WARNING_MINUTES: Number(import.meta.env.VITE_SESSION_WARNING_MINUTES) || 25,

  /** Minutes of inactivity before automatic logout occurs (default: 30 mins) */
  SESSION_TIMEOUT_MINUTES: Number(import.meta.env.VITE_SESSION_TIMEOUT_MINUTES) || 30,

  /** Maximum absolute session lifetime in hours for staff users (default: 12 hours) */
  ABSOLUTE_SESSION_HOURS: Number(import.meta.env.VITE_ABSOLUTE_SESSION_HOURS) || 12,

  /** Debounce window for activity event listeners in milliseconds */
  ACTIVITY_DEBOUNCE_MS: Number(import.meta.env.VITE_ACTIVITY_DEBOUNCE_MS) || 300,

  /** Minimum mouse movement distance in pixels to count as real activity (filters touchpad jitter) */
  MIN_MOUSE_JITTER_PX: 5,

  /** Maximum duration in minutes a busy state (upload/OCR/payment) can suppress idle timeout before auto-expiring */
  SESSION_BUSY_TIMEOUT_MINUTES: Number(import.meta.env.VITE_SESSION_BUSY_TIMEOUT_MINUTES) || 10,

  /** Threshold in minutes: refresh token if expiration is within this window (default: 5 mins) */
  TOKEN_REFRESH_THRESHOLD_MINUTES: Number(import.meta.env.VITE_TOKEN_REFRESH_THRESHOLD_MINUTES) || 5,

  /** Cross-tab BroadcastChannel name */
  BROADCAST_CHANNEL_NAME: 'testimonium_admin_session_channel',

  /** LocalStorage fallback key for cross-tab event sync */
  STORAGE_SYNC_KEY: 'testimonium_session_event_sync',

  /** Storage key for recording absolute session start timestamp */
  SESSION_START_KEY: 'testimonium_session_start_timestamp',
} as const;

/**
 * Session Finite State Machine (FSM) States
 */
export type SessionState =
  | 'ACTIVE'
  | 'WARNING'
  | 'REFRESHING'
  | 'LOGGING_OUT'
  | 'LOGGED_OUT';

/**
 * Explicit reasons for session termination
 */
export type LogoutReason =
  | 'manual'
  | 'idle'
  | 'absolute'
  | 'revoked'
  | 'expired'
  | 'cross-tab'
  | 'network'
  | 'server';

/**
 * Cross-tab event notification payload
 */
export interface SessionBroadcastEvent {
  type: 'LOGOUT' | 'SESSION_EXPIRED' | 'FORCED_LOGOUT' | 'SESSION_EXTENDED';
  reason?: LogoutReason;
  timestamp: number;
  tabId: string;
}
