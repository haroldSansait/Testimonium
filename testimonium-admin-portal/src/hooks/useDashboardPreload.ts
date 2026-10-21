import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { hasPermission } from '@/permissions/rolePermissions';
import { PERMISSIONS } from '@/permissions/permissions';
import { getDocumentRequests } from '@/services/documentRequestService';
import { getScheduleRequests } from '@/services/scheduleRequestService';
import { ParishManagementService } from '@/services/ParishManagementService';
import { privateQueryKey, guardedQuery, queryClient, schedulePreload } from '@/services/queryClient';

export function useDashboardPreload(ready: boolean) {
  const { currentUser, applicationUser, role } = useAuth();
  useEffect(() => {
    if (!ready || !currentUser || !applicationUser || !role) return;
    const tasks: Array<() => Promise<unknown>> = [];
    if (role === 'DIOCESE_COORDINATOR' && hasPermission(role, PERMISSIONS.MANAGE_PARISHES)) {
      const filters = { search: '', type: 'all', status: 'all' };
      tasks.push(() => queryClient.prefetchQuery({ queryKey: privateQueryKey('parishes', 'list', filters),
        queryFn: guardedQuery(() => ParishManagementService.getParishes(filters)), staleTime: 600_000 }));
    } else {
      if (role === 'SECRETARY' && hasPermission(role, PERMISSIONS.VIEW_DOCUMENT_REQUESTS)) {
        const filters = { search: '', documentType: 'all' as const, status: 'all' as const, page: 1, pageSize: 5 };
        tasks.push(() => queryClient.prefetchQuery({ queryKey: privateQueryKey('requests', 'list', filters),
          queryFn: guardedQuery(() => getDocumentRequests(filters)), staleTime: 30_000 }));
      }
      if (hasPermission(role, PERMISSIONS.VIEW_SCHEDULE_REQUESTS)) {
        const filters = { filter: 'all' as const, page: 1, pageSize: 5 };
        tasks.push(() => queryClient.prefetchQuery({ queryKey: privateQueryKey('schedules', 'list', filters),
          queryFn: guardedQuery(() => getScheduleRequests(filters)), staleTime: 30_000 }));
      }
    }
    return schedulePreload(tasks);
  }, [ready, currentUser?.uid, applicationUser?.parishId, role]);
}
