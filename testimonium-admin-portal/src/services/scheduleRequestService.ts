import { providerFactory } from '@/providers/providerFactory';
import type { ScheduleRequest, ScheduleStatus } from '@/types';
import type { PaginatedResponse } from '@/types/api';
import type { ProposeReschedulePayload } from '@/providers/interfaces';

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

export async function proposeReschedule(id: string, payload: ProposeReschedulePayload): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().proposeReschedule(id, payload);
}

export async function respondReschedule(id: string, accept: boolean): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().respondReschedule(id, accept);
}

export async function assignPriest(id: string, priestId: string): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().assignPriest(id, priestId);
}

export async function respondPriestAssignment(id: string, status: 'ACCEPTED' | 'REJECTED', reason?: string): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().respondPriestAssignment(id, status, reason);
}

export async function getAvailableSlots(parishId: string, date: string, eventType: string): Promise<string[]> {
  return providerFactory.getScheduleProvider().getAvailableSlots(parishId, date, eventType);
}
