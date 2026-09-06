import { providerFactory } from '@/providers/providerFactory';
import type { ScheduleRequest, ScheduleStatus } from '@/types';
import type { PaginatedResponse } from '@/types/api';
import type { ProposeReschedulePayload, EmergencyReschedulePayload, PriestAvailabilityItem } from '@/providers/interfaces';

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

export async function updateScheduleStatus(id: string, status: ScheduleStatus, expectedVersion: number): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().updateScheduleStatus(id, status, expectedVersion);
}

export async function proposeReschedule(id: string, payload: ProposeReschedulePayload): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().proposeReschedule(id, payload);
}

export async function respondReschedule(id: string, accept: boolean, expectedVersion: number): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().respondReschedule(id, accept, expectedVersion);
}

export async function assignPriest(id: string, priestId: string, expectedVersion: number): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().assignPriest(id, priestId, expectedVersion);
}

export async function emergencyReschedule(id: string, payload: EmergencyReschedulePayload): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().emergencyReschedule(id, payload);
}

export async function respondPriestAssignment(id: string, status: 'ACCEPTED' | 'REJECTED', reason: string | undefined, expectedVersion: number): Promise<ScheduleRequest> {
  return providerFactory.getScheduleProvider().respondPriestAssignment(id, status, reason, expectedVersion);
}

export async function getAvailableSlots(parishId: string, date: string, eventType: string): Promise<string[]> {
  return providerFactory.getScheduleProvider().getAvailableSlots(parishId, date, eventType);
}

export async function getPriestAvailability(
  scheduleId: string,
  params?: { date?: string; time?: string; startDatetime?: string }
): Promise<PriestAvailabilityItem[]> {
  return providerFactory.getScheduleProvider().getPriestAvailability(scheduleId, params);
}
