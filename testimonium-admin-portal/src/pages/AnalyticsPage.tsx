import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BarChart3,
  CalendarDays,
  FileText,
  Landmark,
  Loader2,
  RefreshCw,
  RotateCcw,
  ScrollText,
  Users,
} from 'lucide-react';
import api from '@/api/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { AnalyticsSelect, type SelectOptionGroup } from '@/components/ui/AnalyticsSelect';
import { ParishManagementService } from '@/services/ParishManagementService';
import { useAuth } from '@/hooks/useAuth';
import { ErrorState } from '@/components/common/ErrorState';
import type { Parish } from '@/types';
import type { ApiError, ApiResponseEnvelope } from '@/types/api';

type CountRow = Record<string, unknown> & { _count?: number; count?: number };
type MonthlyRow = { month: string; count: number; amount?: string };

interface AnalyticsData {
  documents: {
    total: number;
    byType: CountRow[];
    byStatus: CountRow[];
    monthly: MonthlyRow[];
    averageProcessingHours: number;
  };
  payments: {
    totalTransactions: number;
    receiptsSubmitted: number;
    corrections: number;
    verifiedAmount: string;
    byStatus: CountRow[];
    monthly: MonthlyRow[];
  };
  scheduling: {
    total: number;
    byType: CountRow[];
    byStatus: CountRow[];
    monthlyBySubmissionDate: MonthlyRow[];
    busiestWeekdaysByRequestedDate: CountRow[];
  };
  events: {
    total: number;
    byVisibility: CountRow[];
    byType: CountRow[];
    monthlyByEventDate: MonthlyRow[];
  };
  reports: {
    total: number;
    byCategory: CountRow[];
    monthlyByReportDate: MonthlyRow[];
  };
  users: {
    byRole: Array<{ role: string; count: number }>;
    monthlyGrowth: MonthlyRow[];
  } | null;
  parishComparisons: {
    documents: CountRow[];
    schedules: CountRow[];
  } | null;
}

const tabs = ['documents', 'payments', 'scheduling', 'events', 'reports', 'users'] as const;
type Tab = (typeof tabs)[number];

const tabMeta: Record<Tab, { label: string; icon: React.ComponentType<{ className?: string }>; noDataMessage: string }> = {
  documents: {
    label: 'Documents',
    icon: FileText,
    noDataMessage: 'No document request records found for this period.',
  },
  payments: {
    label: 'Payments',
    icon: Landmark,
    noDataMessage: 'No payment transaction data found for this period.',
  },
  scheduling: {
    label: 'Scheduling',
    icon: CalendarDays,
    noDataMessage: 'No scheduling requests found for this period.',
  },
  events: {
    label: 'Parish Events',
    icon: BarChart3,
    noDataMessage: 'No parish event records found for this period.',
  },
  reports: {
    label: 'Daily Reports',
    icon: ScrollText,
    noDataMessage: 'No daily report records found for this period.',
  },
  users: {
    label: 'Users',
    icon: Users,
    noDataMessage: 'No user registration data found for this period.',
  },
};

function labelFor(row: CountRow): string {
  const entry = Object.entries(row).find(([key]) => !['_count', 'count'].includes(key));
  return String(entry?.[1] ?? 'Unknown').replaceAll('_', ' ');
}

function CountBars({ rows, emptyMessage = 'No records in this period.' }: { rows: CountRow[]; emptyMessage?: string }) {
  const maximum = Math.max(1, ...rows.map((row) => Number(row._count ?? row.count ?? 0)));

  if (rows.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-gray-200 p-4 text-center">
        <p className="text-xs font-medium text-gray-400">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5">
      {rows.map((row, index) => {
        const value = Number(row._count ?? row.count ?? 0);
        const percentage = Math.round((value / maximum) * 100);
        const label = labelFor(row);

        return (
          <div key={`${label}-${index}`} className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-medium text-gray-700">
              <span className="capitalize">{label.toLowerCase()}</span>
              <span className="font-bold text-gray-900">{value.toLocaleString()}</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-crimson-700 transition-all duration-300"
                style={{ width: `${Math.max(3, percentage)}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyChart({
  rows,
  label,
  emptyMessage = 'No monthly activity recorded.',
}: {
  rows: MonthlyRow[];
  label: string;
  emptyMessage?: string;
}) {
  const maximum = Math.max(1, ...rows.map((row) => Number(row.count)));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</h3>
        {rows.length > 0 && (
          <span className="text-[11px] font-medium text-gray-400">
            Peak: {maximum.toLocaleString()}
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-gray-200 p-4 text-center">
          <p className="text-xs font-medium text-gray-400">{emptyMessage}</p>
        </div>
      ) : (
        <div className="flex h-48 items-end gap-2 overflow-x-auto border-b border-gray-200 pb-2 pt-4">
          {rows.map((row) => {
            const count = Number(row.count);
            const heightPercent = maximum > 0 ? Math.max(8, (count / maximum) * 130) : 8;

            return (
              <div
                key={row.month}
                className="group relative flex min-w-12 flex-1 flex-col items-center justify-end gap-1.5"
              >
                <span className="text-[10px] font-bold text-gray-700 transition-colors group-hover:text-crimson-700">
                  {count.toLocaleString()}
                </span>
                <div
                  className="w-full max-w-10 rounded-t-md bg-crimson-700/85 transition-all duration-200 group-hover:bg-crimson-700"
                  style={{ height: `${heightPercent}px` }}
                />
                <span className="text-[10px] font-medium text-gray-500 whitespace-nowrap">
                  {row.month}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-2">
            <div className="h-3 w-20 rounded bg-gray-200" />
            <div className="h-7 w-28 rounded bg-gray-200" />
          </div>
        ))}
      </div>

      {/* Chart & Breakdowns Skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="h-4 w-40 rounded bg-gray-200" />
          <div className="h-44 rounded bg-gray-100" />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <div className="h-4 w-36 rounded bg-gray-200" />
          <div className="space-y-3 pt-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <div className="h-3 w-24 rounded bg-gray-200" />
                  <div className="h-3 w-8 rounded bg-gray-200" />
                </div>
                <div className="h-2.5 w-full rounded-full bg-gray-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const documentTypeGroups: SelectOptionGroup[] = [
  {
    groupName: 'Sacramental Certificates',
    options: [
      { value: 'BAPTISMAL_CERTIFICATE', label: 'Baptismal Certificate' },
      { value: 'CONFIRMATION_CERTIFICATE', label: 'Confirmation Certificate' },
      { value: 'FIRST_COMMUNION_CERTIFICATE', label: 'First Communion Certificate' },
      { value: 'MARRIAGE_CERTIFICATE', label: 'Marriage Certificate' },
    ],
  },
  {
    groupName: 'Canonical Permissions & Banns',
    options: [
      { value: 'MARRIAGE_BANNS', label: 'Marriage Banns' },
      { value: 'PERMIT_TO_MARRY', label: 'Permit to Marry' },
      { value: 'STATUS_OF_LIBERTY', label: 'Status of Liberty' },
    ],
  },
];

const documentStatusGroups: SelectOptionGroup[] = [
  {
    groupName: 'Review & Correction',
    options: [
      { value: 'PENDING', label: 'Pending Review' },
      { value: 'UNDER_REVIEW', label: 'Under Review' },
      { value: 'NEEDS_CORRECTION', label: 'Needs Correction' },
    ],
  },
  {
    groupName: 'Payment Stages',
    options: [
      { value: 'PAYMENT_PENDING', label: 'Payment Pending' },
      { value: 'PAYMENT_UNDER_REVIEW', label: 'Payment Under Review' },
      { value: 'PAYMENT_NEEDS_CORRECTION', label: 'Payment Needs Correction' },
      { value: 'PAYMENT_VERIFIED', label: 'Payment Verified' },
    ],
  },
  {
    groupName: 'Processing & Fulfillment',
    options: [
      { value: 'PROCESSING', label: 'Processing' },
      { value: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
    ],
  },
  {
    groupName: 'Final / Resolved',
    options: [
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
  },
];

const eventTypeGroups: SelectOptionGroup[] = [
  {
    groupName: 'Sacraments & Rites',
    options: [
      { value: 'BAPTISM', label: 'Baptism' },
      { value: 'CONFIRMATION', label: 'Confirmation' },
      { value: 'FIRST_COMMUNION', label: 'First Communion' },
      { value: 'WEDDING', label: 'Marriage Canonical Interview' },
      { value: 'MARRIAGE_SPECIAL', label: 'Marriage Special' },
      { value: 'CONFESSION', label: 'Confession' },
      { value: 'ANOINTING_OF_THE_SICK', label: 'Anointing of the Sick' },
    ],
  },
  {
    groupName: 'Masses & Intentions',
    options: [
      { value: 'MASS_INTENTION', label: 'Mass Intention' },
      { value: 'FUNERAL', label: 'Funeral Mass' },
      { value: 'WAKE_MASS', label: 'Wake Mass' },
      { value: 'PRIVATE_MASS', label: 'Private Mass' },
      { value: 'MASS_OF_HOLY_SPIRIT', label: 'Mass of the Holy Spirit' },
    ],
  },
  {
    groupName: 'Blessings & Pastoral Ministry',
    options: [
      { value: 'BLESSING', label: 'Blessing' },
      { value: 'DELIVERANCE', label: 'Deliverance' },
    ],
  },
  {
    groupName: 'Community Celebrations',
    options: [
      { value: 'FIESTA', label: 'Fiesta' },
      { value: 'THANKSGIVING', label: 'Thanksgiving' },
    ],
  },
];

const scheduleStatusGroups: SelectOptionGroup[] = [
  {
    groupName: 'Initial & In Review',
    options: [
      { value: 'PENDING', label: 'Pending' },
      { value: 'REQUESTED', label: 'Requested' },
      { value: 'WAITING_PARISHIONER_RESPONSE', label: 'Waiting Parishioner Response' },
    ],
  },
  {
    groupName: 'Rescheduling',
    options: [
      { value: 'PROPOSED_RESCHEDULE', label: 'Proposed Reschedule' },
    ],
  },
  {
    groupName: 'Confirmed',
    options: [
      { value: 'CONFIRMED', label: 'Confirmed' },
    ],
  },
  {
    groupName: 'Final / Resolved',
    options: [
      { value: 'COMPLETED', label: 'Completed' },
      { value: 'REJECTED', label: 'Rejected' },
      { value: 'CANCELLED', label: 'Cancelled' },
    ],
  },
];

const reportCategoryGroups: SelectOptionGroup[] = [
  {
    groupName: 'Parish Operations',
    options: [
      { value: 'MEETING', label: 'Meeting' },
      { value: 'ACTIVITY', label: 'Activity' },
      { value: 'IMPORTANT_EVENT', label: 'Important Event' },
      { value: 'OTHER', label: 'Other' },
    ],
  },
];

export function AnalyticsPage() {
  const { role } = useAuth();
  const coordinator = role === 'DIOCESE_COORDINATOR';

  // Request generation counter for race-condition protection
  const requestIdRef = useRef(0);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [parishId, setParishId] = useState('');

  // Default 1-year window
  const [from, setFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 364);
    return date.toISOString().slice(0, 10);
  });
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [tab, setTab] = useState<Tab>('documents');

  // Sub-filter states
  const [documentType, setDocumentType] = useState('');
  const [eventType, setEventType] = useState('');
  const [documentStatus, setDocumentStatus] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [category, setCategory] = useState('');

  // Async states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (coordinator) {
      void ParishManagementService.getParishes().then(setParishes).catch(() => {});
    }
  }, [coordinator]);

  const parishGroups = useMemo<SelectOptionGroup[]>(() => {
    return [
      {
        groupName: 'Parishes in Diocese',
        options: parishes.map((parish) => ({
          value: String(parish.id),
          label: parish.name,
          secondary: parish.address || undefined,
        })),
      },
    ];
  }, [parishes]);

  // Race-protected analytics fetch
  const load = useCallback(async () => {
    const currentRequestId = ++requestIdRef.current;
    setError('');
    setLoading(true);

    try {
      const response = await api.get<ApiResponseEnvelope<AnalyticsData>>('/analytics/descriptive', {
        params: {
          from,
          to,
          parishId: parishId || undefined,
          documentType: documentType || undefined,
          eventType: eventType || undefined,
          status:
            tab === 'documents'
              ? documentStatus || undefined
              : tab === 'scheduling'
              ? scheduleStatus || undefined
              : undefined,
          category: category || undefined,
        },
      });

      // Ignore stale responses if another fetch was triggered
      if (currentRequestId === requestIdRef.current) {
        setData(response.data.data);
      }
    } catch (caught) {
      if (currentRequestId === requestIdRef.current) {
        setError((caught as ApiError)?.message || 'Unable to load descriptive analytics.');
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [category, documentStatus, documentType, eventType, from, parishId, scheduleStatus, tab, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const resetFilters = () => {
    const defaultDate = new Date();
    defaultDate.setDate(defaultDate.getDate() - 364);
    setFrom(defaultDate.toISOString().slice(0, 10));
    setTo(new Date().toISOString().slice(0, 10));
    setParishId('');
    setDocumentType('');
    setEventType('');
    setDocumentStatus('');
    setScheduleStatus('');
    setCategory('');
  };

  const content = useMemo(() => {
    if (!data) return null;

    if (tab === 'documents') {
      return {
        cards: [
          { label: 'Total Requests', value: data.documents.total.toLocaleString() },
          {
            label: 'Avg Processing Time',
            value: `${data.documents.averageProcessingHours.toFixed(1)} hrs`,
          },
        ],
        groups: [
          { label: 'Requests by Document Type', rows: data.documents.byType },
          { label: 'Requests by Status', rows: data.documents.byStatus },
        ],
        monthly: data.documents.monthly,
        monthlyLabel: 'Document Requests by Submission Month',
        total: data.documents.total,
      };
    }

    if (tab === 'payments') {
      return {
        cards: [
          { label: 'Total Transactions', value: data.payments.totalTransactions.toLocaleString() },
          { label: 'Receipts Submitted', value: data.payments.receiptsSubmitted.toLocaleString() },
          { label: 'Corrections', value: data.payments.corrections.toLocaleString() },
          { label: 'Verified Amount', value: `₱${data.payments.verifiedAmount}` },
        ],
        groups: [{ label: 'Transactions by Status', rows: data.payments.byStatus }],
        monthly: data.payments.monthly,
        monthlyLabel: 'Verified Payments by Transaction Month',
        total: data.payments.totalTransactions,
      };
    }

    if (tab === 'scheduling') {
      return {
        cards: [{ label: 'Total Scheduling Requests', value: data.scheduling.total.toLocaleString() }],
        groups: [
          { label: 'Requests by Service Type', rows: data.scheduling.byType },
          { label: 'Requests by Status', rows: data.scheduling.byStatus },
          {
            label: 'Busiest Requested Weekdays',
            rows: data.scheduling.busiestWeekdaysByRequestedDate,
          },
        ],
        monthly: data.scheduling.monthlyBySubmissionDate,
        monthlyLabel: 'Scheduling Requests by Submission Month',
        total: data.scheduling.total,
      };
    }

    if (tab === 'events') {
      return {
        cards: [{ label: 'Total Parish Events', value: data.events.total.toLocaleString() }],
        groups: [
          { label: 'Events by Visibility', rows: data.events.byVisibility },
          { label: 'Events by Type', rows: data.events.byType },
        ],
        monthly: data.events.monthlyByEventDate,
        monthlyLabel: 'Events by Event Month',
        total: data.events.total,
      };
    }

    if (tab === 'reports') {
      return {
        cards: [{ label: 'Total Daily Reports', value: data.reports.total.toLocaleString() }],
        groups: [{ label: 'Reports by Category', rows: data.reports.byCategory }],
        monthly: data.reports.monthlyByReportDate,
        monthlyLabel: 'Daily Reports by Report Month',
        total: data.reports.total,
      };
    }

    // Users tab (coordinator only)
    return data.users
      ? {
          cards: [{ label: 'Roles Represented', value: String(data.users.byRole.length) }],
          groups: [{ label: 'Users by Role', rows: data.users.byRole as unknown as CountRow[] }],
          monthly: data.users.monthlyGrowth,
          monthlyLabel: 'New Registered Users by Month',
          total: data.users.byRole.reduce((acc, curr) => acc + curr.count, 0),
        }
      : null;
  }, [data, tab]);

  const activeTabMeta = tabMeta[tab];
  const isUpdating = loading && Boolean(data);

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Descriptive Analytics"
        subtitle="Operational counts and trends with explicit date semantics."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-crimson-700' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {/* From Date */}
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              From Date
            </label>
            <input
              type="date"
              value={from}
              onChange={(event) => setFrom(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-xs outline-none transition-all hover:border-gray-400 focus:border-crimson-700 focus:ring-2 focus:ring-crimson-700/20"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-600">
              To Date
            </label>
            <input
              type="date"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm text-gray-900 shadow-xs outline-none transition-all hover:border-gray-400 focus:border-crimson-700 focus:ring-2 focus:ring-crimson-700/20"
            />
          </div>

          {/* Parish Filter (Coordinator only) */}
          {coordinator && (
            <AnalyticsSelect
              label="Parish"
              value={parishId}
              onChange={(nextParishId) => {
                setParishId(nextParishId);
                if (nextParishId && tab === 'users') {
                  setTab('documents');
                }
              }}
              allOptionLabel="All parishes (Diocese-wide)"
              groups={parishGroups}
              searchPlaceholder="Search parish..."
            />
          )}

          {/* Document Tab Filters */}
          {tab === 'documents' && (
            <>
              <AnalyticsSelect
                label="Document Type"
                value={documentType}
                onChange={setDocumentType}
                allOptionLabel="All document types"
                groups={documentTypeGroups}
                searchPlaceholder="Search document type..."
              />

              <AnalyticsSelect
                label="Request Status"
                value={documentStatus}
                onChange={setDocumentStatus}
                allOptionLabel="All request statuses"
                groups={documentStatusGroups}
                searchPlaceholder="Search status..."
              />
            </>
          )}

          {/* Scheduling and Events Tab Filters */}
          {(tab === 'scheduling' || tab === 'events') && (
            <AnalyticsSelect
              label="Service / Event Type"
              value={eventType}
              onChange={setEventType}
              allOptionLabel="All service types"
              groups={eventTypeGroups}
              searchPlaceholder="Search service or event..."
            />
          )}

          {/* Schedule Status Filter */}
          {tab === 'scheduling' && (
            <AnalyticsSelect
              label="Schedule Status"
              value={scheduleStatus}
              onChange={setScheduleStatus}
              allOptionLabel="All schedule statuses"
              groups={scheduleStatusGroups}
              searchPlaceholder="Search status..."
            />
          )}

          {/* Daily Reports Tab Filter */}
          {tab === 'reports' && (
            <AnalyticsSelect
              label="Report Category"
              value={category}
              onChange={setCategory}
              allOptionLabel="All categories"
              groups={reportCategoryGroups}
              searchPlaceholder="Search category..."
            />
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <span>
              Scope:{' '}
              <strong className="text-gray-700">
                {parishId
                  ? parishes.find((p) => String(p.id) === String(parishId))?.name || 'Selected Parish'
                  : coordinator
                  ? 'All Parishes'
                  : 'Assigned Parish'}
              </strong>
            </span>
          </div>
          <button
            type="button"
            onClick={resetFilters}
            className="inline-flex items-center gap-1 text-xs font-semibold text-crimson-700 hover:text-crimson-800 hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Reset filters
          </button>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs
          .filter((item) => item !== 'users' || coordinator)
          .map((item) => {
            const meta = tabMeta[item];
            const Icon = meta.icon;
            const isActive = tab === item;
            const isUsersDisabled = item === 'users' && Boolean(parishId);

            return (
              <button
                key={item}
                type="button"
                disabled={isUsersDisabled}
                aria-disabled={isUsersDisabled}
                onClick={() => {
                  if (!isUsersDisabled) {
                    setTab(item);
                  }
                }}
                title={
                  isUsersDisabled
                    ? 'User analytics are diocese-wide. Select All Parishes to view this section.'
                    : undefined
                }
                className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                  isUsersDisabled
                    ? 'cursor-not-allowed border border-gray-200 bg-gray-100/70 text-gray-400 opacity-60'
                    : isActive
                    ? 'bg-crimson-700 text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{meta.label}</span>
              </button>
            );
          })}
      </div>

      {/* Updating Banner (Retaining data while refetching) */}
      {isUpdating && (
        <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-medium text-blue-800">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" />
          <span>Updating analytics for selected filters...</span>
        </div>
      )}

      {/* Error State */}
      {error && !data && <ErrorState message={error} onRetry={() => void load()} />}

      {/* Initial Loading Skeleton */}
      {loading && !data && <AnalyticsSkeleton />}

      {/* Analytics Content Area */}
      {content ? (
        <div className="space-y-6">
          {/* KPI Cards Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {content.cards.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</p>
                <p className="mt-2 text-2xl font-bold text-gray-900 tracking-tight">{value}</p>
              </div>
            ))}
          </div>

          {/* Charts & Breakdown Rows */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Monthly Trend Card */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <MonthlyChart
                rows={content.monthly}
                label={content.monthlyLabel}
                emptyMessage={activeTabMeta.noDataMessage}
              />
            </div>

            {/* Categorical Breakdown Groups */}
            {content.groups.map(({ label, rows }) => (
              <div key={label} className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">{label}</h3>
                <CountBars rows={[...rows]} emptyMessage={`No breakdown records for this period.`} />
              </div>
            ))}
          </div>

          {/* Coordinator-Only Diocesan Parish Comparison */}
          {coordinator && !parishId && data?.parishComparisons && (tab === 'documents' || tab === 'scheduling') && (
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Diocese-Wide Parish Comparison
                </h3>
                <span className="text-[11px] font-semibold text-crimson-700 uppercase">
                  Coordinator View
                </span>
              </div>
              <CountBars
                rows={(tab === 'documents'
                  ? data.parishComparisons.documents
                  : data.parishComparisons.schedules
                ).map((row) => ({
                  parish:
                    parishes.find((p) => Number(p.id) === Number(row.parishId))?.name ||
                    `Parish ID ${row.parishId}`,
                  _count: row._count,
                }))}
                emptyMessage="No comparative parish data available for this query."
              />
            </div>
          )}
        </div>
      ) : (
        !loading && (
          <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-sm">
            <Users className="h-8 w-8 text-gray-400" />
            <h4 className="mt-3 text-sm font-bold text-gray-900">
              {tab === 'users' && parishId
                ? 'User Analytics are Diocese-Wide'
                : 'Analytics Data Unavailable'}
            </h4>
            <p className="mt-1 max-w-md text-xs text-gray-500">
              {tab === 'users' && parishId
                ? 'User registration metrics and role distributions are diocese-wide. Select "All parishes" in the parish filter to view this section.'
                : activeTabMeta.noDataMessage}
            </p>
          </div>
        )
      )}
    </div>
  );
}
