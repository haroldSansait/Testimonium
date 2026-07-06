import { useState, useEffect, useCallback } from 'react';
import { Filter } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Pagination } from '@/components/ui/Pagination';
import { ScheduleRequestTable } from '@/components/schedule-requests/ScheduleRequestTable';
import { getScheduleRequests } from '@/services/scheduleRequestService';
import type { ScheduleRequest } from '@/types';
import type { ScheduleFilter } from '@/services/scheduleRequestService';
import { cn } from '@/utils/cn';

const FILTER_TABS: { label: string; value: ScheduleFilter }[] = [
  { label: 'All Requests', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'Upcoming', value: 'upcoming' },
];

export function ScheduleRequestsPage() {
  const [activeFilter, setActiveFilter] = useState<ScheduleFilter>('all');
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<ScheduleRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const PAGE_SIZE = 5;

  const fetchRequests = useCallback(async () => {
    const result = await getScheduleRequests({ filter: activeFilter, page, pageSize: PAGE_SIZE });
    setRequests(result.data);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [activeFilter, page]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  const handleFilter = (f: ScheduleFilter) => {
    setActiveFilter(f);
    setPage(1);
  };

  return (
    <div>
      {/* Header with tab filters */}
      <div className="flex items-start justify-between mb-6">
        <PageHeader
          title="Schedule Requests"
          subtitle="Manage incoming scheduling applications for parish events."
          className="mb-0"
        />
        {/* Tab filters */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 flex-shrink-0 ml-4">
          <Filter className="w-4 h-4 text-gray-400 mx-1" />
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              id={`schedule-filter-${tab.value}`}
              onClick={() => handleFilter(tab.value)}
              className={cn(
                'px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150',
                activeFilter === tab.value
                  ? 'bg-crimson-700 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <ScheduleRequestTable requests={requests} />
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
