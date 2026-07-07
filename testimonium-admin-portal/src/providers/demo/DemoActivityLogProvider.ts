import type { ActivityLogProvider, ActivityLogFilters } from '../interfaces';
import type { ActivityLogEntry } from '@/types';
import type { PaginatedResponse } from '@/types/api';
import { activityLog } from '@/mock/activityLog';

export const DemoActivityLogProvider: ActivityLogProvider = {
  async getActivityLog(filters: ActivityLogFilters = {}): Promise<PaginatedResponse<ActivityLogEntry>> {
    const { page = 1, pageSize = 4, personnel, actionType } = filters;
    let result = [...activityLog];

    if (personnel && personnel !== 'All Personnel') {
      result = result.filter(r => r.personnel === personnel);
    }
    if (actionType && actionType !== 'All Actions') {
      const actLower = actionType.toLowerCase();
      result = result.filter(r => r.actionDescription.toLowerCase().includes(actLower));
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
  }
};
