import type { IServiceProvider } from '../types';
import { apiServiceProvider } from '../api';
import { demoServiceProvider } from '../demo';

// Hybrid mode allows combinations such as:
// - live authentication (apiServiceProvider.auth)
// - live parish data (apiServiceProvider.parish)
// - demo requests (demoServiceProvider.request)
// - demo notifications (demoServiceProvider.notification)
export const hybridServiceProvider: IServiceProvider = {
  auth: apiServiceProvider.auth,
  profile: apiServiceProvider.profile,
  parish: apiServiceProvider.parish,
  request: apiServiceProvider.request,
  scheduler: apiServiceProvider.scheduler,
  notification: apiServiceProvider.notification,
  announcement: apiServiceProvider.announcement,
  chat: demoServiceProvider.chat,
  map: demoServiceProvider.map,
  event: demoServiceProvider.event,
  payment: apiServiceProvider.payment,
};

