import type { ActivityLogProvider, ActivityLogFilters } from '../interfaces';
import type { ActivityLogEntry } from '@/types';
import type { PaginatedResponse } from '@/types/api';
import { activityLog } from '@/mock/activityLog';

// Setup isSystem on some mock logs for local dev/demo testing
let store: ActivityLogEntry[] = activityLog.map((log, idx) => {
  let role = 'System';
  if (log.personnel === 'Carlos Mendoza') role = 'Diocese Coordinator';
  else if (log.personnel === 'Maria Santos') role = 'Secretary';

  return {
    ...log,
    role,
    isSystem: idx === activityLog.length - 1 || log.actionDescription.toLowerCase().includes('initialize') || log.actionDescription.toLowerCase().includes('migration'),
    archivedAt: null,
    archivedBy: null,
    archivedByName: null,
  };
});

export const DemoActivityLogProvider: ActivityLogProvider = {
  async getActivityLog(filters: ActivityLogFilters = {}): Promise<PaginatedResponse<ActivityLogEntry>> {
    const { page = 1, pageSize = 4, role, actionType, status = 'Active' } = filters;
    let result = [...store];

    // Filter by role
    if (role && role !== 'All Roles') {
      result = result.filter(r => r.role === role);
    }
    // Filter by action
    if (actionType && actionType !== 'All Actions') {
      if (actionType === 'Staff Assignment') {
        result = result.filter(r => r.actionDescription.toLowerCase().includes('priest') || r.actionDescription.toLowerCase().includes('secretary'));
      } else if (actionType === 'Authentication') {
        result = result.filter(r => r.actionDescription.toLowerCase().includes('login') || r.actionDescription.toLowerCase().includes('logout'));
      } else if (actionType === 'Activity Logs') {
        result = result.filter(r => r.actionDescription.toLowerCase().includes('archived') || r.actionDescription.toLowerCase().includes('restored') || r.actionDescription.toLowerCase().includes('purged'));
      } else if (actionType === 'Document Management') {
        result = result.filter(r => r.actionDescription.toLowerCase().includes('document') || r.actionDescription.toLowerCase().includes('schedule'));
      } else if (actionType === 'User Management') {
        result = result.filter(r => r.actionDescription.toLowerCase().includes('user') || r.actionDescription.toLowerCase().includes('reset'));
      } else if (actionType === 'Parish Management') {
        result = result.filter(r => r.actionDescription.toLowerCase().includes('parish'));
      } else if (actionType === 'System') {
        result = result.filter(r => r.actionDescription.toLowerCase().includes('migration') || r.actionDescription.toLowerCase().includes('system') || r.isSystem);
      } else {
        const actLower = actionType.toLowerCase();
        result = result.filter(r => r.actionDescription.toLowerCase().includes(actLower));
      }
    }
    // Filter by Status
    if (status === 'Archived') {
      result = result.filter(r => r.archivedAt !== null);
    } else if (status === 'Active') {
      result = result.filter(r => r.archivedAt === null);
    }

    const total = result.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedData = result.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const activeCount = store.filter(r => r.archivedAt === null).length;
    const archivedCount = store.filter(r => r.archivedAt !== null).length;

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
      active: activeCount,
      archived: archivedCount,
    };
  },

  async archiveSelected(ids: string[]): Promise<void> {
    store = store.map(log => {
      if (ids.includes(log.id) && !log.isSystem) {
        return {
          ...log,
          archivedAt: new Date().toISOString(),
          archivedBy: 1,
          archivedByName: 'Harold Sansait',
        };
      }
      return log;
    });
  },

  async archiveAll(): Promise<void> {
    store = store.map(log => {
      if (log.archivedAt === null && !log.isSystem) {
        return {
          ...log,
          archivedAt: new Date().toISOString(),
          archivedBy: 1,
          archivedByName: 'Harold Sansait',
        };
      }
      return log;
    });
  },

  async restoreSelected(ids: string[]): Promise<void> {
    store = store.map(log => {
      if (ids.includes(log.id)) {
        return {
          ...log,
          archivedAt: null,
          archivedBy: null,
          archivedByName: null,
        };
      }
      return log;
    });
  },

  async restoreAll(): Promise<void> {
    store = store.map(log => {
      return {
        ...log,
        archivedAt: null,
        archivedBy: null,
        archivedByName: null,
      };
    });
  },

  async purgeArchived(): Promise<void> {
    store = store.filter(log => log.archivedAt === null);
  }
};
