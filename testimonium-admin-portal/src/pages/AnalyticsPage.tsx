import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  FileText,
  Filter,
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
import { documentStatusGroups } from '@/shared/documentAnalytics';
import { ParishManagementService } from '@/services/ParishManagementService';
import { useAuth } from '@/hooks/useAuth';
import { ErrorState } from '@/components/common/ErrorState';
import { VerifiedPaymentsTable } from '@/components/analytics/VerifiedPaymentsTable';
import { AnalyticsTelemetryDeck, type TelemetryMetric } from '@/components/analytics/AnalyticsTelemetryDeck';
import { DailyTrendChart, type DailyDataPoint } from '@/components/analytics/DailyTrendChart';
import { StatusDonutChart, type StatusDistributionRow } from '@/components/analytics/StatusDonutChart';
import { RankedHorizontalBarChart, type CategoryCountRow } from '@/components/analytics/RankedHorizontalBarChart';
import { WeekdayActivityChart, type WeekdayRow } from '@/components/analytics/WeekdayActivityChart';
import {
  type DatePresetKey,
  DATE_PRESET_LABELS,
  getActiveDatePreset,
  getManilaDefaultDateRange,
  getManilaPresetRange,
} from '@/utils/date';
import type { Parish } from '@/types';
import type { ApiError, ApiResponseEnvelope } from '@/types/api';

type CountRow = Record<string, unknown> & { _count?: number; count?: number };
type DailyRow = DailyDataPoint;
type MonthlyRow = { month: string; count: number; amount?: string };

interface AnalyticsData {
  documents: {
    total: number;
    byType: CountRow[];
    byStatus: CountRow[];
    daily: DailyRow[];
    monthly?: MonthlyRow[];
    averageProcessingHours: number;
  };
  payments: {
    totalTransactions: number;
    receiptsSubmitted: number;
    corrections: number;
    verifiedAmount: string;
    byStatus: CountRow[];
    daily: DailyRow[];
    monthly?: MonthlyRow[];
  };
  scheduling: {
    total: number;
    byType: CountRow[];
    byStatus: CountRow[];
    dailyBySubmissionDate: DailyRow[];
    monthlyBySubmissionDate?: MonthlyRow[];
    busiestWeekdaysByRequestedDate: CountRow[];
  };
  events: {
    total: number;
    byVisibility: CountRow[];
    byType: CountRow[];
    dailyByEventDate: DailyRow[];
    monthlyByEventDate?: MonthlyRow[];
  };
  reports: {
    total: number;
    byCategory: CountRow[];
    dailyByReportDate: DailyRow[];
    monthlyByReportDate?: MonthlyRow[];
  };
  users: {
    byRole: Array<{ role: string; count: number }>;
    dailyGrowth: DailyRow[];
    monthlyGrowth?: MonthlyRow[];
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

function AnalyticsSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Telemetry Deck Skeleton */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-xs overflow-hidden">
        <div className="h-10 border-b border-gray-100 bg-gray-50/70" />
        <div className="grid grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-gray-100">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="p-5 space-y-2">
              <div className="h-3 w-20 rounded bg-gray-200" />
              <div className="h-8 w-28 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      </div>

      {/* Chart & Breakdowns Skeleton */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="h-4 w-48 rounded bg-gray-200" />
          <div className="h-48 rounded bg-gray-50" />
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
          <div className="h-4 w-36 rounded bg-gray-200" />
          <div className="h-48 rounded bg-gray-50" />
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
      { value: 'PRIVATE_MASS', label: 'Mass' },
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

interface ContentData {
  telemetry: TelemetryMetric[];
  daily: DailyRow[];
  dailyTitle: string;
  valueLabel: string;
  statusRows: StatusDistributionRow[] | null;
  typeRows: CategoryCountRow[] | null;
  categoryRows: CategoryCountRow[] | null;
  weekdays: WeekdayRow[] | null;
  total: number;
}

export function AnalyticsPage() {
  const { role } = useAuth();
  const coordinator = role === 'DIOCESE_COORDINATOR';

  // Request generation counter for race-condition protection
  const requestIdRef = useRef(0);

  const [data, setData] = useState<AnalyticsData | null>(null);
  const dataRef = useRef<AnalyticsData | null>(null);
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [parishId, setParishId] = useState('');

  // Default 1-year Manila window
  const [from, setFrom] = useState(() => getManilaDefaultDateRange().from);
  const [to, setTo] = useState(() => getManilaDefaultDateRange().to);
  const [paymentRefreshTrigger, setPaymentRefreshTrigger] = useState(0);
  const [tab, setTab] = useState<Tab>('documents');
  const [dataEpoch, setDataEpoch] = useState(0);

  const activePreset = useMemo(() => {
    return getActiveDatePreset(from, to);
  }, [from, to]);

  // Sub-filter states
  const [documentType, setDocumentType] = useState('');
  const [eventType, setEventType] = useState('');
  const [documentStatus, setDocumentStatus] = useState('');
  const [scheduleStatus, setScheduleStatus] = useState('');
  const [category, setCategory] = useState('');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [staleError, setStaleError] = useState('');
  const dataQueryKeyRef = useRef('');

  const buildQueryKey = useCallback(
    (
      pFrom: string,
      pTo: string,
      pParish: string,
      pDoc: string,
      pEvent: string,
      pStatus: string,
      pCategory: string,
      pTab: string
    ) => `${pFrom}|${pTo}|${pParish}|${pDoc}|${pEvent}|${pStatus}|${pCategory}|${pTab}`,
    []
  );

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
  const load = useCallback(
    async (options?: { isManualRefresh?: boolean }) => {
      const isManualRefresh = options?.isManualRefresh ?? false;
      const currentRequestId = ++requestIdRef.current;
      const currentStatus =
        tab === 'documents'
          ? documentStatus || undefined
          : tab === 'scheduling'
          ? scheduleStatus || undefined
          : undefined;

      const targetKey = buildQueryKey(
        from,
        to,
        parishId,
        documentType,
        eventType,
        currentStatus || '',
        category,
        tab
      );
      const isSameQuery = dataQueryKeyRef.current === targetKey;

      setError('');
      setStaleError('');
      setLoading(true);

      // On automatic query changes, do not retain previous query data as current
      if (!isSameQuery) {
        setData(null);
        dataRef.current = null;
      }

      try {
        const response = await api.get<ApiResponseEnvelope<AnalyticsData>>('/analytics/descriptive', {
          params: {
            from,
            to,
            parishId: parishId || undefined,
            documentType: documentType || undefined,
            eventType: eventType || undefined,
            status: currentStatus,
            category: category || undefined,
          },
        });

        // Ignore stale responses if another fetch was triggered
        if (currentRequestId === requestIdRef.current) {
          setData(response.data.data);
          dataRef.current = response.data.data;
          dataQueryKeyRef.current = targetKey;
          setDataEpoch((prev) => prev + 1);
          setError('');
          setStaleError('');
        }
      } catch (caught) {
        if (currentRequestId === requestIdRef.current) {
          if (isManualRefresh && isSameQuery && dataRef.current) {
            // Same-query manual refresh failure with existing data retains data and shows inline stale warning
            setStaleError('Unable to refresh analytics. The figures shown may be outdated.');
          } else {
            // Initial or new-query failure clears data and shows full error state
            setData(null);
            dataRef.current = null;
            dataQueryKeyRef.current = '';
            setError((caught as ApiError)?.message || 'Unable to load descriptive analytics.');
          }
        }
      } finally {
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [buildQueryKey, category, documentStatus, documentType, eventType, from, parishId, scheduleStatus, tab, to]
  );

  useEffect(() => {
    void load({ isManualRefresh: false });
  }, [load]);

  const resetFilters = () => {
    const defaultRange = getManilaDefaultDateRange();
    setFrom(defaultRange.from);
    setTo(defaultRange.to);
    setParishId('');
    setDocumentType('');
    setEventType('');
    setDocumentStatus('');
    setScheduleStatus('');
    setCategory('');
    setStaleError('');
  };

  const content = useMemo<ContentData | null>(() => {
    if (!data) return null;

    if (tab === 'documents') {
      return {
        telemetry: [
          {
            label: 'Total Requests',
            value: data.documents.total.toLocaleString(),
            hint: 'Submitted requests in selected range',
            icon: 'file',
          },
          {
            label: 'Avg Processing Time',
            value: `${data.documents.averageProcessingHours.toFixed(1)} hrs`,
            hint: 'From request to completion',
            icon: 'clock',
          },
        ],
        daily: data.documents.daily || (data.documents.monthly as unknown as DailyRow[]) || [],
        dailyTitle: 'Document Requests by Submission Date',
        valueLabel: 'Requests',
        statusRows: data.documents.byStatus,
        typeRows: data.documents.byType,
        categoryRows: null,
        weekdays: null,
        total: data.documents.total,
      };
    }

    if (tab === 'payments') {
      return {
        telemetry: [
          {
            label: 'Total Transactions',
            value: data.payments.totalTransactions.toLocaleString(),
            hint: 'All payment records',
            icon: 'landmark',
          },
          {
            label: 'Receipts Submitted',
            value: data.payments.receiptsSubmitted.toLocaleString(),
            hint: 'Uploaded by parishioners',
            icon: 'receipt',
          },
          {
            label: 'Corrections',
            value: data.payments.corrections.toLocaleString(),
            hint: 'Transactions needing correction',
            icon: 'correction',
          },
          {
            label: 'Verified Amount',
            value: `₱${data.payments.verifiedAmount}`,
            hint: 'Total verified revenue',
            icon: 'verified',
          },
        ],
        daily: data.payments.daily || (data.payments.monthly as unknown as DailyRow[]) || [],
        dailyTitle: 'Payment Transactions by Transaction Date',
        valueLabel: 'Verified Transactions',
        statusRows: data.payments.byStatus,
        typeRows: null,
        categoryRows: null,
        weekdays: null,
        total: data.payments.totalTransactions,
      };
    }

    if (tab === 'scheduling') {
      return {
        telemetry: [
          {
            label: 'Total Scheduling Requests',
            value: data.scheduling.total.toLocaleString(),
            hint: 'Parish sacrament bookings',
            icon: 'schedule',
          },
        ],
        daily: data.scheduling.dailyBySubmissionDate || (data.scheduling.monthlyBySubmissionDate as unknown as DailyRow[]) || [],
        dailyTitle: 'Schedule Requests by Submission Date',
        valueLabel: 'Schedules',
        statusRows: data.scheduling.byStatus,
        typeRows: data.scheduling.byType,
        categoryRows: null,
        weekdays: data.scheduling.busiestWeekdaysByRequestedDate,
        total: data.scheduling.total,
      };
    }

    if (tab === 'events') {
      return {
        telemetry: [
          {
            label: 'Total Parish Events',
            value: data.events.total.toLocaleString(),
            hint: 'Scheduled ceremonies & liturgies',
            icon: 'calendar',
          },
        ],
        daily: data.events.dailyByEventDate || (data.events.monthlyByEventDate as unknown as DailyRow[]) || [],
        dailyTitle: 'Parish Events by Event Date',
        valueLabel: 'Events',
        statusRows: data.events.byVisibility,
        typeRows: data.events.byType,
        categoryRows: null,
        weekdays: null,
        total: data.events.total,
      };
    }

    if (tab === 'reports') {
      return {
        telemetry: [
          {
            label: 'Total Daily Reports',
            value: data.reports.total.toLocaleString(),
            hint: 'Logged operational reports',
            icon: 'report',
          },
        ],
        daily: data.reports.dailyByReportDate || (data.reports.monthlyByReportDate as unknown as DailyRow[]) || [],
        dailyTitle: 'Daily Reports by Report Date',
        valueLabel: 'Reports',
        statusRows: null,
        typeRows: null,
        categoryRows: data.reports.byCategory,
        weekdays: null,
        total: data.reports.total,
      };
    }

    // Users tab (coordinator only)
    if (data.users) {
      const totalUsers = data.users.byRole.reduce((acc, curr) => acc + curr.count, 0);
      return {
        telemetry: [
          {
            label: 'Roles Represented',
            value: String(data.users.byRole.length),
            hint: 'Canonical user roles',
            icon: 'shield',
          },
          {
            label: 'Total Registered Users',
            value: totalUsers.toLocaleString(),
            hint: 'Diocese-wide accounts',
            icon: 'users',
          },
        ],
        daily: data.users.dailyGrowth || (data.users.monthlyGrowth as unknown as DailyRow[]) || [],
        dailyTitle: 'User Registrations by Registration Date',
        valueLabel: 'New Users',
        statusRows: data.users.byRole as unknown as CountRow[],
        typeRows: null,
        categoryRows: null,
        weekdays: null,
        total: totalUsers,
      };
    }

    return null;
  }, [data, tab]);

  const activeTabMeta = tabMeta[tab];
  const isUpdating = loading && Boolean(data);

  const handleRefresh = () => {
    void load({ isManualRefresh: true });
    if (tab === 'payments') {
      setPaymentRefreshTrigger((prev) => prev + 1);
    }
  };

  const activeScopeName = parishId
    ? parishes.find((p) => String(p.id) === String(parishId))?.name || 'Selected Parish'
    : coordinator
    ? 'All Parishes'
    : 'Assigned Parish';

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <PageHeader
        title="Descriptive Analytics"
        subtitle="Operational telemetry and daily trends with explicit date semantics."
        actions={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-crimson-700' : ''}`} />
            Refresh
          </button>
        }
      />

      {/* Filter Toolbar */}
      <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-crimson-700" />
            <span className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Filter Parameters & Scope
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600">
              Scope: <strong className="font-bold text-gray-800">{activeScopeName}</strong>
            </span>
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

        {/* Quick Date Range Presets */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100/80 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500 mr-1.5">
              Quick Range:
            </span>
            {(['7d', '1m', '6m', '1y'] as DatePresetKey[]).map((preset) => {
              const isSelected = activePreset === preset;
              return (
                <button
                  key={preset}
                  type="button"
                  onClick={() => {
                    const range = getManilaPresetRange(preset);
                    setFrom(range.from);
                    setTo(range.to);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-crimson-700 text-white shadow-xs'
                      : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300'
                  }`}
                >
                  {DATE_PRESET_LABELS[preset]}
                </button>
              );
            })}
            {activePreset === 'custom' && (
              <span className="inline-flex items-center rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">
                Custom
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
            Asia/Manila calendar window
          </span>
        </div>

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

          {/* Document Type Filter (Documents OR Payments) */}
          {(tab === 'documents' || tab === 'payments') && (
            <AnalyticsSelect
              label="Document Type"
              value={documentType}
              onChange={setDocumentType}
              allOptionLabel="All document types"
              groups={documentTypeGroups}
              searchPlaceholder="Search document type..."
            />
          )}

          {/* Request Status Filter (Documents only) */}
          {tab === 'documents' && (
            <AnalyticsSelect
              label="Request Status"
              value={documentStatus}
              onChange={setDocumentStatus}
              allOptionLabel="All request statuses"
              groups={documentStatusGroups}
              searchPlaceholder="Search status..."
            />
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

      {/* Stale Data Warning Banner (when same-query refresh fails with existing data) */}
      {staleError && data && (
        <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-900">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{staleError}</span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-1 font-semibold text-amber-800 hover:underline cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      {/* Error State */}
      {error && !data && <ErrorState message={error} onRetry={handleRefresh} />}

      {/* Initial Loading Skeleton */}
      {loading && !data && <AnalyticsSkeleton />}

      {/* Analytics Content Area */}
      {content ? (
        <div className="space-y-6">
          {/* 1. Consolidated Summary Telemetry Panel */}
          <AnalyticsTelemetryDeck
            animationKey={dataEpoch}
            metrics={content.telemetry}
            domainTitle={`${tabMeta[tab].label} Telemetry`}
            scopeLabel={activeScopeName}
            dateRangeLabel={`${from} to ${to}`}
          />

          {/* 2. Visualizations Grid */}
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Primary Time-Series Area Trend (Continuous Zero-Filled Daily Series) */}
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
              <DailyTrendChart
                animationKey={dataEpoch}
                from={from}
                to={to}
                rows={content.daily}
                title={content.dailyTitle}
                valueLabel={content.valueLabel}
                emptyMessage={activeTabMeta.noDataMessage}
              />
            </div>

            {/* Categorical Breakdown: Status Donut or Category Chart */}
            {content.statusRows ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                <StatusDonutChart
                  animationKey={dataEpoch}
                  title={
                    tab === 'documents'
                      ? 'Requests by Status'
                      : tab === 'payments'
                      ? 'Transactions by Status'
                      : tab === 'scheduling'
                      ? 'Schedule Requests by Status'
                      : tab === 'events'
                      ? 'Events by Visibility'
                      : 'Users by Role'
                  }
                  rows={content.statusRows}
                  emptyMessage="No status distribution records for this period."
                />
              </div>
            ) : content.categoryRows ? (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                <RankedHorizontalBarChart
                  animationKey={dataEpoch}
                  title="Reports by Category"
                  rows={content.categoryRows}
                  emptyMessage="No category records for this period."
                />
              </div>
            ) : null}

            {/* Secondary Category / Service Type Ranking */}
            {content.typeRows && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <RankedHorizontalBarChart
                  animationKey={dataEpoch}
                  title={
                    tab === 'documents'
                      ? 'Requests by Document Type'
                      : tab === 'scheduling'
                      ? 'Requests by Service Type'
                      : 'Events by Type'
                  }
                  rows={content.typeRows}
                  emptyMessage="No category breakdown records for this period."
                />
              </div>
            )}

            {/* Documents Tab: Row 2 - Right (Diocese-Wide Parish Comparison) */}
            {tab === 'documents' && coordinator && !parishId && data?.parishComparisons?.documents && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <RankedHorizontalBarChart
                  animationKey={dataEpoch}
                  title="Diocese-Wide Parish Comparison"
                  badgeLabel="Coordinator View"
                  rows={data.parishComparisons.documents.map((row) => ({
                    parish:
                      parishes.find((p) => Number(p.id) === Number(row.parishId))?.name ||
                      `Parish ID ${row.parishId}`,
                    _count: row._count,
                  }))}
                  emptyMessage="No comparative parish data available for this query."
                />
              </div>
            )}

            {/* Scheduling Tab: Weekday Heatmap */}
            {content.weekdays && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
                <WeekdayActivityChart
                  animationKey={dataEpoch}
                  title="Busiest Requested Weekdays"
                  rows={content.weekdays}
                  emptyMessage="No weekday scheduling records for this period."
                />
              </div>
            )}

            {/* Scheduling Tab: Diocese-Wide Parish Comparison */}
            {tab === 'scheduling' && coordinator && !parishId && data?.parishComparisons?.schedules && (
              <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs flex flex-col justify-between">
                <RankedHorizontalBarChart
                  animationKey={dataEpoch}
                  title="Diocese-Wide Parish Comparison"
                  badgeLabel="Coordinator View"
                  rows={data.parishComparisons.schedules.map((row) => ({
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

          {/* Payments Tab: Verified Payments Detail Table */}
          {tab === 'payments' && (
            <VerifiedPaymentsTable
              from={from}
              to={to}
              parishId={parishId}
              documentType={documentType}
              coordinator={coordinator}
              refreshTrigger={paymentRefreshTrigger}
            />
          )}
        </div>
      ) : (
        !loading && (
          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center shadow-xs">
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
