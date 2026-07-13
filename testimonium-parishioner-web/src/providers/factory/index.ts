import type { IServiceProvider } from '../types';
import { demoServiceProvider } from '../demo';
import { apiServiceProvider } from '../api';
import { hybridServiceProvider } from '../hybrid';

const PROVIDER_MODE = import.meta.env.VITE_PROVIDER_MODE || 'demo';

export function getServiceProvider(): IServiceProvider {
  if (PROVIDER_MODE === 'api') {
    return apiServiceProvider;
  }
  if (PROVIDER_MODE === 'hybrid') {
    return hybridServiceProvider;
  }
  return demoServiceProvider;
}

export const services = getServiceProvider();
export default services;
