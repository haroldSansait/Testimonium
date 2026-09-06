import type { ScheduleProvider, ScheduleRequestFilters, ProposeReschedulePayload, EmergencyReschedulePayload, PriestAvailabilityItem } from '../interfaces';
import type { ScheduleRequest, ScheduleStatus } from '@/types';
import type { PaginatedResponse } from '@/types/api';
import { scheduleRequests } from '@/mock/scheduleRequests';

let store: ScheduleRequest[] = scheduleRequests.map(r => ({
  ...r,
  assignedPriest: r.status === 'Confirmed' ? 'Fr. Michael Reyes' : 'TBD',
  parish: 'St. Joseph the Worker Parish',
  contactInfo: '+63 917 123 4567 • maria@gmail.com',
  notes: `Request for event type ${r.eventType} preferred at ${r.preferredTime}.`,
  timeline: [
    { status: 'Pending', date: r.preferredDate, note: 'Schedule request submitted.' },
    ...(r.status === 'Under Review' ? [{ status: 'Under Review', date: r.preferredDate, note: 'Parish staff reviewing.' }] : []),
    ...(r.status === 'Confirmed' ? [{ status: 'Confirmed', date: r.preferredDate, note: 'Approved and scheduled.' }] : []),
    ...(r.status === 'Tentative' ? [{ status: 'Tentative', date: r.preferredDate, note: 'Pending confirmation of conflicting slot.' }] : []),
  ]
}));

export const DemoScheduleProvider: ScheduleProvider = {
  async getScheduleRequests(filters: ScheduleRequestFilters = {}): Promise<PaginatedResponse<ScheduleRequest>> {
    const { filter = 'all', page = 1, pageSize = 5 } = filters;
    let result = [...store];

    if (filter === 'pending') {
      result = result.filter((r) => r.status === 'Pending' || r.status === 'Under Review' || r.status === 'Tentative');
    } else if (filter === 'upcoming') {
      result = result.filter((r) => r.status === 'Confirmed');
    }

    const total = result.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedData = result.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  async getScheduleRequest(id: string): Promise<ScheduleRequest> {
    const match = store.find(r => r.id === id);
    if (!match) throw new Error(`Schedule request ${id} not found`);
    return match;
  },

  async updateScheduleStatus(id: string, status: ScheduleStatus, _expectedVersion: number): Promise<ScheduleRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      const todayStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const newTimeline = [...(r.timeline || [])];

      let note = 'Status updated.';
      if (status === 'Confirmed') note = 'Approved and scheduled.';
      else if (status === 'Cancelled') note = 'Request cancelled.';
      else if (status === 'Under Review') note = 'Parish staff reviewing.';

      newTimeline.push({
        status,
        date: todayStr,
        note
      });

      return {
        ...r,
        status,
        assignedPriest: status === 'Confirmed' ? 'Fr. Michael Reyes' : r.assignedPriest,
        version: (r.version ?? 1) + 1,
        timeline: newTimeline
      };
    });

    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Schedule request ${id} not found`);
    return updated;
  },

  async proposeReschedule(id: string, payload: ProposeReschedulePayload): Promise<ScheduleRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      const todayStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const newTimeline = [...(r.timeline || [])];
      newTimeline.push({
        status: 'Tentative',
        date: todayStr,
        note: `Alternative date proposed: ${payload.proposedDate}. Reason: ${payload.reason}`
      });

      return {
        ...r,
        status: 'Tentative' as ScheduleStatus,
        proposedDate: payload.proposedDate,
        rescheduleReason: payload.reason,
        version: (r.version ?? 1) + 1,
        timeline: newTimeline
      };
    });

    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Schedule request ${id} not found`);
    return updated;
  },

  async respondReschedule(id: string, accept: boolean, _expectedVersion: number): Promise<ScheduleRequest> {
    const targetStatus: ScheduleStatus = accept ? 'Confirmed' : 'Cancelled';
    const request = store.find((item) => item.id === id);
    return this.updateScheduleStatus(id, targetStatus, request?.version ?? 1);
  },

  async assignPriest(id: string, priestId: string, _expectedVersion: number): Promise<ScheduleRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        assignedPriest: `Priest ID ${priestId}`,
        assignedPriestId: priestId,
        version: (r.version ?? 1) + 1,
      };
    });
    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Schedule request ${id} not found`);
    return updated;
  },

  async emergencyReschedule(id: string, payload: EmergencyReschedulePayload): Promise<ScheduleRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      const todayStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const newTimeline = [...(r.timeline || [])];
      newTimeline.push({
        status: 'Confirmed',
        date: todayStr,
        note: `Emergency rescheduled to ${payload.targetDate} (${payload.timeSlot}). Reason: ${payload.reason}`
      });

      return {
        ...r,
        preferredDate: payload.targetDate,
        preferredTime: payload.timeSlot,
        version: (r.version ?? 1) + 1,
        timeline: newTimeline
      };
    });
    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Schedule request ${id} not found`);
    return updated;
  },

  async respondPriestAssignment(id: string, status: 'ACCEPTED' | 'REJECTED', reason: string | undefined, _expectedVersion: number): Promise<ScheduleRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        priestResponseStatus: status,
        priestResponseReason: reason || null,
      };
    });
    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Schedule request ${id} not found`);
    return updated;
  },

  async getAvailableSlots(_parishId: string, _date: string, _eventType: string): Promise<string[]> {
    // Demo stub — return representative canonical time slots
    return ['08:00 AM', '09:30 AM', '10:30 AM', '02:00 PM', '03:30 PM'];
  },

  async getPriestAvailability(scheduleId: string, _params?: { date?: string; time?: string; startDatetime?: string }): Promise<PriestAvailabilityItem[]> {
    const req = store.find(r => r.id === scheduleId);
    if (req?.preferredDate?.includes('Sep 26') || scheduleId === 'sched-req-3') {
      return [
        { priestId: '1', available: true },
        { priestId: '2', available: false, reasonCode: 'PRIEST_UNAVAILABLE' },
      ];
    }
    return [
      { priestId: '1', available: true },
      { priestId: '2', available: true },
    ];
  },
};
