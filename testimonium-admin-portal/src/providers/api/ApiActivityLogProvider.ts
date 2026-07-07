import api from '@/api/api';
import type { ActivityLogProvider, ActivityLogFilters } from '../interfaces';
import type { ActivityLogEntry, ActivityStatus } from '@/types';
import type { PaginatedResponse, BackendPaginatedResponse } from '@/types/api';

interface BackendActivityLogDTO {
  id: number;
  userId: number | null;
  action: string;
  affectedTable: string | null;
  affectedRecordId: number | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: {
    id: number;
    fullName: string;
    email: string;
  } | null;
}

const formatActionDescription = (action: string): string => {
  switch (action) {
    case 'APPROVED_SCHEDULE': return 'Approved schedule request';
    case 'REJECTED_SCHEDULE': return 'Rejected schedule request';
    case 'CREATED_DOCUMENT_REQUEST': return 'Created document request';
    case 'UPDATED_DOCUMENT_REQUEST_STATUS': return 'Updated document request status';
    default:
      return action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  }
};

export const ApiActivityLogProvider: ActivityLogProvider = {
  async getActivityLog(
    filters: ActivityLogFilters = {}
  ): Promise<PaginatedResponse<ActivityLogEntry>> {
    const { page = 1, pageSize = 4, personnel, actionType, dateRange } = filters;

    const response = await api.get<BackendPaginatedResponse<BackendActivityLogDTO>>('/activity-log', {
      params: {
        page,
        limit: pageSize,
        ...(personnel && personnel !== 'All Personnel' ? { personnel } : {}),
        ...(actionType && actionType !== 'All Actions' ? { action: actionType } : {}),
        ...(dateRange ? { dateRange } : {}),
      },
    });

    const colors = ['bg-blue-500', 'bg-purple-500', 'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-indigo-500'];

    const getInitials = (name: string) => {
      const parts = name.split(' ');
      if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return (name[0] || '').toUpperCase();
    };

    const mappedData = (response.data.data || []).map((dbItem): ActivityLogEntry => {
      const date = new Date(dbItem.createdAt);
      const dateString = date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      const timeString = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const dateTimeStr = `${dateString} ${timeString}`;

      const name = dbItem.user?.fullName || 'System';
      const initials = getInitials(name);
      const colorIndex = (dbItem.user?.id || 0) % colors.length;
      const avatarBg = colors[colorIndex];

      let statusUpdate: ActivityStatus = 'Pending';
      const actionLower = (dbItem.action || '').toLowerCase();
      if (actionLower.includes('approve')) statusUpdate = 'Approved';
      else if (actionLower.includes('reject')) statusUpdate = 'Rejected';
      else if (actionLower.includes('review')) statusUpdate = 'Under Review';
      else if (actionLower.includes('validate') || actionLower.includes('create')) statusUpdate = 'Validated';

      const prefix = dbItem.affectedTable === 'schedules' ? 'SCH' : 'DOC';

      return {
        id: String(dbItem.id),
        dateTime: dateTimeStr,
        personnel: name,
        avatar: { initials, bgColor: avatarBg },
        actionDescription: formatActionDescription(dbItem.action || ''),
        referenceId: dbItem.affectedRecordId ? `${prefix}-${dbItem.affectedRecordId}` : 'N/A',
        statusUpdate,
      };
    });

    return {
      data: mappedData,
      total: response.data.pagination?.total || 0,
      page: response.data.pagination?.page || page,
      pageSize: response.data.pagination?.limit || pageSize,
      totalPages: response.data.pagination?.totalPages || 1,
    };
  }
};
