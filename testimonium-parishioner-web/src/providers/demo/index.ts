import type { IServiceProvider } from '../types';
import { DemoAuthProvider } from './auth';
import { DemoProfileProvider } from './profile';
import { DemoParishProvider } from './parish';
import { DemoRequestProvider } from './request';
import { DemoSchedulerProvider } from './scheduler';
import { DemoNotificationProvider } from './notification';
import { DemoAnnouncementProvider } from './announcement';
import { DemoChatProvider } from './chat';
import { DemoMapProvider } from './map';
import { DemoEventProvider } from './event';
import { DemoPaymentConfigurationProvider } from './payment';

export const demoServiceProvider: IServiceProvider = {
  auth: new DemoAuthProvider(),
  profile: new DemoProfileProvider(),
  parish: new DemoParishProvider(),
  request: new DemoRequestProvider(),
  scheduler: new DemoSchedulerProvider(),
  notification: new DemoNotificationProvider(),
  announcement: new DemoAnnouncementProvider(),
  chat: new DemoChatProvider(),
  map: new DemoMapProvider(),
  event: new DemoEventProvider(),
  payment: new DemoPaymentConfigurationProvider(),
};

