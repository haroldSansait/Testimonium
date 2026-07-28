import type { ScheduleProvider, ScheduleRequestFilters, ProposeReschedulePayload } from '../interfaces';
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

  async updateScheduleStatus(id: string, status: ScheduleStatus): Promise<ScheduleRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      const todayStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const newTimeline = [...(r.timeline || [])];
      newTimeline.push({
        status,
        date: todayStr,
        note: `Status updated to ${status}.`
      });

      return {
        ...r,
        status,
        assignedPriest: status === 'Confirmed' ? 'Fr. Michael Reyes' : r.assignedPriest,
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
        timeline: newTimeline
      };
    });

    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Schedule request ${id} not found`);
    return updated;
  },

  async respondReschedule(id: string, accept: boolean): Promise<ScheduleRequest> {
    const targetStatus: ScheduleStatus = accept ? 'Confirmed' : 'Cancelled';
    return this.updateScheduleStatus(id, targetStatus);
  },

  async assignPriest(id: string, priestId: string): Promise<ScheduleRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      return {
        ...r,
        assignedPriest: `Priest ID ${priestId}`
      };
    });
    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Schedule request ${id} not found`);
    return updated;
  },

  async respondPriestAssignment(id: string, status: 'ACCEPTED' | 'REJECTED', reason?: string): Promise<ScheduleRequest> {
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
  }
};
