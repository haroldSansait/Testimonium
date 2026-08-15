import { providerFactory } from '@/providers/providerFactory';
import type { ActivityLogEntry } from '@/types';
import type { PaginatedResponse } from '@/types/api';

export interface ActivityLogFilters {
  page?: number;
  pageSize?: number;
  role?: string;
  actionType?: string;
  dateRange?: string;
  status?: 'All' | 'Active' | 'Archived';
}

export const ActivityLogService = {
  async getActivityLog(
    filters: ActivityLogFilters = {}
  ): Promise<PaginatedResponse<ActivityLogEntry>> {
    return providerFactory.getActivityLogProvider().getActivityLog(filters);
  },

  async archiveSelected(ids: string[]): Promise<void> {
    return providerFactory.getActivityLogProvider().archiveSelected(ids);
  },

  async archiveAll(): Promise<void> {
    return providerFactory.getActivityLogProvider().archiveAll();
  },

  async restoreSelected(ids: string[]): Promise<void> {
    return providerFactory.getActivityLogProvider().restoreSelected(ids);
  },

  async restoreAll(): Promise<void> {
    return providerFactory.getActivityLogProvider().restoreAll();
  },

  async purgeArchived(): Promise<void> {
    return providerFactory.getActivityLogProvider().purgeArchived();
  },

  async getActionTypes(): Promise<string[]> {
    return providerFactory.getActivityLogProvider().getActionTypes();
  }
};
