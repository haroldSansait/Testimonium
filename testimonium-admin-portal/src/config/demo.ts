export type ProviderMode = 'demo' | 'api';

export const DATA_PROVIDER = (import.meta.env.VITE_DATA_PROVIDER || 'demo').toLowerCase() as 'demo' | 'api' | 'hybrid';

export const HYBRID_CONFIG: Record<string, ProviderMode> = {
  dashboard: 'api',
  notifications: 'api',
  documents: 'api',
  schedules: 'api',
  calendar: 'api',
  activityLog: 'api',
  dioceseDashboard: 'api',
  analytics: 'api',
  parishes: 'api',
  users: 'api',
  financialAnalytics: 'demo',
};
