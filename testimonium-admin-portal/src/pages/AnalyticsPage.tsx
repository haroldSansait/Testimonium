import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Cross,
  FileText,
  Church,
  Clock,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { PageHeader } from '@/components/ui/PageHeader';
import { AnalyticsService } from '@/services/AnalyticsService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import type {
  SacramentStat,
  DocumentAnalyticsStat,
  ParishAnalyticsStat,
} from '@/types';

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  subtitle,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-xl border border-gray-100 shadow-card p-6', className)}>
      <div className="mb-5">
        <h3 className="text-base font-semibold text-gray-900">{title}</h3>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'sacraments', label: 'Sacraments',  icon: <Cross className="w-4 h-4" /> },
  { id: 'documents',  label: 'Documents',   icon: <FileText className="w-4 h-4" /> },
  { id: 'parishes',   label: 'Parishes',    icon: <Church className="w-4 h-4" /> },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Sacraments tab ───────────────────────────────────────────────────────────

function SacramentsTab({ data }: { data: SacramentStat[] }) {
  const sacramentColors: Record<string, { bg: string; bar: string }> = {
    Baptisms:      { bg: 'bg-blue-50',    bar: 'bg-blue-500' },
    Confirmations: { bg: 'bg-purple-50',  bar: 'bg-purple-500' },
    Weddings:      { bg: 'bg-pink-50',    bar: 'bg-pink-500' },
    Funerals:      { bg: 'bg-gray-100',   bar: 'bg-gray-400' },
  };

  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <SectionCard
      title="Sacrament Statistics"
      subtitle="Total sacraments administered across all parishes this year"
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {data.map((stat) => {
          const colors = sacramentColors[stat.type] ?? { bg: 'bg-gray-100', bar: 'bg-gray-400' };
          const isPositive = stat.trend > 0;
          const isNeutral = stat.trend === 0;
          return (
            <div key={stat.type} className={cn('rounded-xl p-4', colors.bg)}>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                {stat.type}
              </p>
              <p
                className="text-3xl font-bold text-gray-900 mb-2"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {stat.count.toLocaleString()}
              </p>
              <div className="flex items-center gap-1">
                {isNeutral ? (
                  <Minus className="w-3.5 h-3.5 text-gray-400" />
                ) : isPositive ? (
                  <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <TrendingDown className="w-3.5 h-3.5 text-red-500" />
                )}
                <span
                  className={cn(
                    'text-xs font-medium',
                    isNeutral ? 'text-gray-400' : isPositive ? 'text-green-600' : 'text-red-600'
                  )}
                >
                  {isPositive ? '+' : ''}{stat.trend}% vs last period
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Simple bar chart representation */}
      <div className="space-y-3">
        {data.map((stat) => {
          const colors = sacramentColors[stat.type] ?? { bg: 'bg-gray-100', bar: 'bg-gray-400' };
          const width = Math.round((stat.count / maxCount) * 100);
          return (
            <div key={stat.type} className="flex items-center gap-3">
              <span className="text-xs text-gray-500 w-24 flex-shrink-0">{stat.type}</span>
              <div className="flex-1 bg-gray-100 rounded-full h-2">
                <div
                  className={cn('h-2 rounded-full transition-all duration-500', colors.bar)}
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="text-xs font-semibold text-gray-700 w-10 text-right">
                {stat.count}
              </span>
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}

// ─── Documents tab ────────────────────────────────────────────────────────────

function DocumentsTab({ data }: { data: DocumentAnalyticsStat[] }) {
  return (
    <SectionCard
      title="Document Request Analytics"
      subtitle="Requests by type, completion rates, and average processing time"
    >
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Document Type</th>
              <th className="text-right">Requests</th>
              <th>Completion Rate</th>
              <th className="text-right">
                <span className="inline-flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> Avg. Processing
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((stat) => (
              <tr key={stat.documentType}>
                <td className="font-medium text-gray-900">{stat.documentType}</td>
                <td className="text-right text-gray-700">{stat.requestCount.toLocaleString()}</td>
                <td>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[80px]">
                      <div
                        className={cn(
                          'h-1.5 rounded-full',
                          stat.completionRate >= 90
                            ? 'bg-green-500'
                            : stat.completionRate >= 75
                            ? 'bg-amber-500'
                            : 'bg-red-500'
                        )}
                        style={{ width: `${stat.completionRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-700 w-8">
                      {stat.completionRate}%
                    </span>
                  </div>
                </td>
                <td className="text-right text-gray-600">{stat.avgProcessingDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── Parishes tab ─────────────────────────────────────────────────────────────

function ParishesTab({ data }: { data: ParishAnalyticsStat[] }) {
  const maxRequests = Math.max(...data.map((d) => d.requestCount), 1);

  return (
    <SectionCard
      title="Parish Activity Analytics"
      subtitle="Request volume, active parishioners, and new registrations per parish"
    >
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Parish</th>
              <th>Requests</th>
              <th className="text-right">Active Parishioners</th>
              <th className="text-right">New Registrations</th>
            </tr>
          </thead>
          <tbody>
            {data.map((stat) => {
              const width = Math.round((stat.requestCount / maxRequests) * 100);
              return (
                <tr key={stat.parish}>
                  <td className="font-medium text-gray-900 max-w-[200px] truncate">{stat.parish}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px]">
                        <div
                          className="h-1.5 rounded-full bg-crimson-700"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-xs font-medium text-gray-700 w-6">
                        {stat.requestCount}
                      </span>
                    </div>
                  </td>
                  <td className="text-right text-gray-700">
                    {stat.activeParishioners.toLocaleString()}
                  </td>
                  <td className="text-right">
                    <span className="text-green-600 font-medium">+{stat.newRegistrations}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

// ─── AnalyticsPage ────────────────────────────────────────────────────────────

export function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('sacraments');
  const [sacramentData, setSacramentData] = useState<SacramentStat[]>([]);
  const [documentData, setDocumentData] = useState<DocumentAnalyticsStat[]>([]);
  const [parishData, setParishData] = useState<ParishAnalyticsStat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = () => {
    setIsLoading(true);
    setError(null);
    Promise.all([
      AnalyticsService.getSacramentStats(),
      AnalyticsService.getDocumentStats(),
      AnalyticsService.getParishStats(),
    ])
      .then(([sacraments, documents, parishes]) => {
        setSacramentData(sacraments);
        setDocumentData(documents);
        setParishData(parishes);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load analytics data:', err);
        setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div>
      <PageHeader
        title="Analytics"
        subtitle="Diocese-wide sacramental, document, and parish analytics."
      />

      {/* Tab Bar */}
      <div className="bg-white border border-gray-200 rounded-xl mb-5 p-1 inline-flex gap-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            id={`analytics-tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-150',
              activeTab === tab.id
                ? 'bg-crimson-700 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {isLoading ? (
        <LoadingState message="Loading analytics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <>
          {activeTab === 'sacraments' && <SacramentsTab data={sacramentData} />}
          {activeTab === 'documents'  && <DocumentsTab data={documentData} />}
          {activeTab === 'parishes'   && <ParishesTab data={parishData} />}
        </>
      )}
    </div>
  );
}
