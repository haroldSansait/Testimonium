import type { IServiceProvider } from '../types';
import { ApiAuthProvider } from './auth';
import { ApiProfileProvider } from './profile';
import { ApiParishProvider } from './parish';
import { ApiRequestProvider } from './request';
import { ApiSchedulerProvider } from './scheduler';
import { ApiNotificationProvider } from './notification';
import { ApiAnnouncementProvider } from './announcement';
import { ApiChatProvider } from './chat';
import { ApiMapProvider } from './map';
import { ApiEventProvider } from './event';
import { ApiPaymentConfigurationProvider } from './payment';

export const apiServiceProvider: IServiceProvider = {
  auth: new ApiAuthProvider(),
  profile: new ApiProfileProvider(),
  parish: new ApiParishProvider(),
  request: new ApiRequestProvider(),
  scheduler: new ApiSchedulerProvider(),
  notification: new ApiNotificationProvider(),
  announcement: new ApiAnnouncementProvider(),
  chat: new ApiChatProvider(),
  map: new ApiMapProvider(),
  event: new ApiEventProvider(),
  payment: new ApiPaymentConfigurationProvider(),
};

