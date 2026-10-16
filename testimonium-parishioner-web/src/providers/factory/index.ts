import type { IServiceProvider } from '../types';
import { apiServiceProvider } from '../api';

export function getServiceProvider(): IServiceProvider {
  return apiServiceProvider;
}

export const services = getServiceProvider();
export default services;
