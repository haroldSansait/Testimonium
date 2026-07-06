import { useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ActivityLogTable } from '@/components/activity-log/ActivityLogTable';
import { ActivityLogFilters } from '@/components/activity-log/ActivityLogFilters';
import { ActivityLogService } from '@/services/ActivityLogService';
import type { ActivityLogEntry } from '@/types';

const PAGE_SIZE = 4;

export function ActivityLogPage() {
  const [dateRange, setDateRange] = useState('Oct 1, 2023 - Oct 31, 2023');
  const [personnel, setPersonnel] = useState('All Personnel');
  const [actionType, setActionType] = useState('All Actions');
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const fetchLog = useCallback(async () => {
    const result = await ActivityLogService.getActivityLog({
      page,
      pageSize: PAGE_SIZE,
      personnel,
      actionType,
      dateRange,
    });
    setEntries(result.data);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [page, personnel, actionType, dateRange]);

  useEffect(() => {
    void fetchLog();
  }, [fetchLog]);

  const handlePersonnel = (v: string) => { setPersonnel(v); setPage(1); };
  const handleActionType = (v: string) => { setActionType(v); setPage(1); };

  return (
    <div>
      <PageHeader
        title="Activity Log"
        subtitle="Comprehensive record of administrative actions, document verifications, and system updates."
      />

      <ActivityLogFilters
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        personnel={personnel}
        onPersonnelChange={handlePersonnel}
        actionType={actionType}
        onActionTypeChange={handleActionType}
      />

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <ActivityLogTable entries={entries} />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
