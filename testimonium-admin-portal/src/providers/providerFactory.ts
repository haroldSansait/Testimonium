import { ApiDashboardProvider } from './api/ApiDashboardProvider';
import { ApiNotificationProvider } from './api/ApiNotificationProvider';
import { ApiDocumentProvider } from './api/ApiDocumentProvider';
import { ApiScheduleProvider } from './api/ApiScheduleProvider';
import { ApiCalendarProvider } from './api/ApiCalendarProvider';
import { ApiActivityLogProvider } from './api/ApiActivityLogProvider';
import { ApiDioceseDashboardProvider } from './api/ApiDioceseDashboardProvider';
import { ApiAnalyticsProvider } from './api/ApiAnalyticsProvider';
import { ApiParishProvider } from './api/ApiParishProvider';
import { ApiUserProvider } from './api/ApiUserProvider';
import { ApiAvailabilityProvider } from './api/ApiAvailabilityProvider';
import type {
  DashboardProvider,
  AvailabilityProvider,
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

export const providerFactory = {
  getDashboardProvider(): DashboardProvider {
    return ApiDashboardProvider;
  },
  getNotificationProvider(): NotificationProvider {
    return ApiNotificationProvider;
  },
  getDocumentProvider(): DocumentProvider {
    return ApiDocumentProvider;
  },
  getScheduleProvider(): ScheduleProvider {
    return ApiScheduleProvider;
  },
  getCalendarProvider(): CalendarProvider {
    return ApiCalendarProvider;
  },
  getActivityLogProvider(): ActivityLogProvider {
    return ApiActivityLogProvider;
  },
  getDioceseDashboardProvider(): DioceseDashboardProvider {
    return ApiDioceseDashboardProvider;
  },
  getAnalyticsProvider(): AnalyticsProvider {
    return ApiAnalyticsProvider;
  },
  getParishProvider(): ParishProvider {
    return ApiParishProvider;
  },
  getUserProvider(): UserProvider {
    return ApiUserProvider;
  },
  getAvailabilityProvider(): AvailabilityProvider {
    return ApiAvailabilityProvider;
  },
};
