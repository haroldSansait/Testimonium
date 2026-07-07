import { DATA_PROVIDER, HYBRID_CONFIG } from '@/config/demo';
import { DemoDashboardProvider } from './demo/DemoDashboardProvider';
import { ApiDashboardProvider } from './api/ApiDashboardProvider';
import { DemoNotificationProvider } from './demo/DemoNotificationProvider';
import { ApiNotificationProvider } from './api/ApiNotificationProvider';
import { DemoDocumentProvider } from './demo/DemoDocumentProvider';
import { ApiDocumentProvider } from './api/ApiDocumentProvider';
import { DemoScheduleProvider } from './demo/DemoScheduleProvider';
import { ApiScheduleProvider } from './api/ApiScheduleProvider';
import { DemoCalendarProvider } from './demo/DemoCalendarProvider';
import { ApiCalendarProvider } from './api/ApiCalendarProvider';
import { DemoActivityLogProvider } from './demo/DemoActivityLogProvider';
import { ApiActivityLogProvider } from './api/ApiActivityLogProvider';
import { DemoDioceseDashboardProvider } from './demo/DemoDioceseDashboardProvider';
import { ApiDioceseDashboardProvider } from './api/ApiDioceseDashboardProvider';
import { DemoAnalyticsProvider } from './demo/DemoAnalyticsProvider';
import { ApiAnalyticsProvider } from './api/ApiAnalyticsProvider';
import { DemoParishProvider } from './demo/DemoParishProvider';
import { ApiParishProvider } from './api/ApiParishProvider';
import { DemoUserProvider } from './demo/DemoUserProvider';
import { ApiUserProvider } from './api/ApiUserProvider';
import type {
  DashboardProvider,
  NotificationProvider,
  DocumentProvider,
  ScheduleProvider,
  CalendarProvider,
  ActivityLogProvider,
  DioceseDashboardProvider,
  AnalyticsProvider,
  ParishProvider,
  UserProvider
} from './interfaces';

const resolveProvider = <T>(
  moduleKey: string,
  demoInstance: T,
  apiInstance: T
): T => {
  if (DATA_PROVIDER === 'api') {
    return apiInstance;
  }
  if (DATA_PROVIDER === 'hybrid') {
    const mode = HYBRID_CONFIG[moduleKey] || 'demo';
    return mode === 'api' ? apiInstance : demoInstance;
  }
  // Default to demo
  return demoInstance;
};

export const providerFactory = {
  getDashboardProvider(): DashboardProvider {
    return resolveProvider('dashboard', DemoDashboardProvider, ApiDashboardProvider);
  },
  getNotificationProvider(): NotificationProvider {
    return resolveProvider('notifications', DemoNotificationProvider, ApiNotificationProvider);
  },
  getDocumentProvider(): DocumentProvider {
    return resolveProvider('documents', DemoDocumentProvider, ApiDocumentProvider);
  },
  getScheduleProvider(): ScheduleProvider {
    return resolveProvider('schedules', DemoScheduleProvider, ApiScheduleProvider);
  },
  getCalendarProvider(): CalendarProvider {
    return resolveProvider('calendar', DemoCalendarProvider, ApiCalendarProvider);
  },
  getActivityLogProvider(): ActivityLogProvider {
    return resolveProvider('activityLog', DemoActivityLogProvider, ApiActivityLogProvider);
  },
  getDioceseDashboardProvider(): DioceseDashboardProvider {
    return resolveProvider('dioceseDashboard', DemoDioceseDashboardProvider, ApiDioceseDashboardProvider);
  },
  getAnalyticsProvider(): AnalyticsProvider {
    return resolveProvider('analytics', DemoAnalyticsProvider, ApiAnalyticsProvider);
  },
  getParishProvider(): ParishProvider {
    return resolveProvider('parishes', DemoParishProvider, ApiParishProvider);
  },
  getUserProvider(): UserProvider {
    return resolveProvider('users', DemoUserProvider, ApiUserProvider);
  },
};
