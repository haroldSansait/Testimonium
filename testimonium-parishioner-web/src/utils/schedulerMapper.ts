import { resolveEventType } from '../shared/EventTypeCatalog';

/**
 * Legacy helper retained for imports outside the current scheduler. Unknown
 * labels are deliberately rejected; callers must not turn them into a
 * fabricated Mass Intention booking.
 */
export const mapFrontendToBackendEventType = (serviceName: string): string | null =>
  resolveEventType(serviceName);
