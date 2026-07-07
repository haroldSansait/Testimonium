import { providerFactory } from '@/providers/providerFactory';
import type { ActivityLogEntry } from '@/types';
import type { PaginatedResponse } from '@/types/api';

export interface ActivityLogFilters {
  page?: number;
  pageSize?: number;
  personnel?: string;
  actionType?: string;
  dateRange?: string;
}

export const ActivityLogService = {
  async getActivityLog(
    filters: ActivityLogFilters = {}
  ): Promise<PaginatedResponse<ActivityLogEntry>> {
    return providerFactory.getActivityLogProvider().getActivityLog(filters);
  },
};
