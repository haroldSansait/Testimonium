/**
 * Structured Session Lifecycle Logger
 * Safely logs session lifecycle events without printing tokens, passwords, cookies, or PII.
 */

export type SessionLogEvent =
  | 'Session Started'
  | 'Session Warning Displayed'
  | 'Session Extended'
  | 'Session Refreshed'
  | 'Idle Logout'
  | 'Absolute Timeout Logout'
  | 'Cross-Tab Logout'
  | 'Manual Logout'
  | 'Revoked Token Logout'
  | 'Refresh Failed'
  | 'Network Refresh Retry';

export function logSessionEvent(event: SessionLogEvent, metadata?: Record<string, unknown>): void {
  const timestamp = new Date().toISOString();
  const safeMeta = metadata ? JSON.stringify(metadata) : '';
  console.info(`[SessionSecurity] [${timestamp}] ${event} ${safeMeta}`.trim());
}
