import api from '@/api/api';
import type { ApiResponseEnvelope } from '@/types/api';

export type Weekday = 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
export type DateRuleMode = 'INHERIT' | 'AVAILABLE' | 'UNAVAILABLE';

export interface ParishWeekdayRule {
  id?: number;
  weekday: Weekday;
  isAvailable: boolean;
}

export interface ServiceWeekdayRule extends ParishWeekdayRule {
  eventType: string;
}

export interface DateServiceOverride {
  eventType: string;
  mode: Exclude<DateRuleMode, 'INHERIT'>;
}

export interface ScheduleDateRule {
  id: number;
  exceptionDate: string;
  baseMode: DateRuleMode;
  reason: string | null;
  serviceOverrides: DateServiceOverride[];
}

export interface ScheduleAvailabilityConfiguration {
  id: number;
  schedulingConfigVersion: number;
  weekdayRules: ParishWeekdayRule[];
  serviceWeekdayRules: ServiceWeekdayRule[];
  scheduleDateRules: ScheduleDateRule[];
}

export const scheduleAvailabilityApi = {
  async get(parishId: string): Promise<ScheduleAvailabilityConfiguration> {
    const response = await api.get<ApiResponseEnvelope<ScheduleAvailabilityConfiguration>>(
      `/schedule-availability/parishes/${parishId}`
    );
    return response.data.data;
  },

  async replaceWeekdayRules(parishId: string, payload: {
    expectedVersion: number;
    parishRules: ParishWeekdayRule[];
    serviceRules: ServiceWeekdayRule[];
    eventSettings: Record<string, unknown>;
    officeHours: Record<string, unknown>;
  }): Promise<ScheduleAvailabilityConfiguration> {
    const response = await api.put<ApiResponseEnvelope<ScheduleAvailabilityConfiguration>>(
      `/schedule-availability/parishes/${parishId}/weekday-rules`,
      payload
    );
    return response.data.data;
  },

  async createDateRule(parishId: string, payload: Omit<ScheduleDateRule, 'id'> & { expectedVersion: number }) {
    const response = await api.post<ApiResponseEnvelope<{ rule: ScheduleDateRule; schedulingConfigVersion: number }>>(
      `/schedule-availability/parishes/${parishId}/date-rules`,
      payload
    );
    return response.data.data;
  },

  async updateDateRule(parishId: string, ruleId: number, payload: Omit<ScheduleDateRule, 'id'> & { expectedVersion: number }) {
    const response = await api.patch<ApiResponseEnvelope<{ rule: ScheduleDateRule; schedulingConfigVersion: number }>>(
      `/schedule-availability/parishes/${parishId}/date-rules/${ruleId}`,
      payload
    );
    return response.data.data;
  },

  async deleteDateRule(parishId: string, ruleId: number, expectedVersion: number) {
    const response = await api.delete<ApiResponseEnvelope<{ schedulingConfigVersion: number }>>(
      `/schedule-availability/parishes/${parishId}/date-rules/${ruleId}`,
      { params: { expectedVersion } }
    );
    return response.data.data;
  },
};
