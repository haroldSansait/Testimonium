import { providerFactory } from '@/providers/providerFactory';
import type { ScheduleRequest, ScheduleStatus } from '@/types';
import type { PaginatedResponse } from '@/types/api';

export type ScheduleFilter = 'all' | 'pending' | 'upcoming';

export interface ScheduleRequestFilters {
  filter?: ScheduleFilter;
  page?: number;
  pageSize?: number;
}

export async function getScheduleRequests(
  filters: ScheduleRequestFilters = {}
): Promise<PaginatedResponse<ScheduleRequest>> {
  return providerFactory.getScheduleProvider().getScheduleRequests(filters);
}

export async function getScheduleRequest(id: string): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().getScheduleRequest(id);
}

export async function updateScheduleStatus(id: string, status: ScheduleStatus): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().updateScheduleStatus(id, status);
}
