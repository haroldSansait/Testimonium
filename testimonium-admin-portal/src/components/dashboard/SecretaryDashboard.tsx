import { useDashboardPreload } from '@/hooks/useDashboardPreload';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { StatCard } from '@/components/dashboard/StatCard';
import { TodayScheduleList } from '@/components/dashboard/TodayScheduleList';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { DashboardService } from '@/services/DashboardService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';

/**
 * SecretaryDashboard — parish-level view with pending requests,
 * today's schedule, and recent alerts.
 *
 * Extracted from the original DashboardPage so it can be rendered
 * by the role-router in DashboardPage while keeping its own data-fetching logic.
 */
export function SecretaryDashboard() {
  const dashboard = useCachedQuery(['dashboard'], async () => {
    const [stats, schedule, alerts] = await Promise.all([
      DashboardService.getStats(), DashboardService.getTodaySchedule(), DashboardService.getRecentAlerts(),
    ]);
    return { stats, schedule, alerts };
  });
  const statCards = dashboard.data?.stats ?? [];
  const todaySchedule = dashboard.data?.schedule ?? [];
  const recentAlerts = dashboard.data?.alerts ?? [];
  const isLoading = dashboard.loading;
  const error = dashboard.error;
  const loadData = dashboard.refetch;
  useDashboardPreload(dashboard.isSuccess);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  // Set up auto-refresh polling (every 60 seconds)
  useAutoRefresh(
    () => void loadData(true),
    { intervalMs: 60000, enabled: !isLoading }
  );

  return (
    <div className="space-y-6">
      {/* Page greeting */}
      <div>
        <h1
          className="text-4xl font-bold text-crimson-700"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          {greeting}
        </h1>
        <p className="text-gray-505 mt-1 text-sm">
          Here is the current status of parish administrative requests.
        </p>
      </div>

      {isLoading ? (
        <LoadingState message="Loading dashboard statistics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={() => void loadData(false)} />
      ) : (
        <>
          {/* Stat Cards Grid */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
            {statCards.map((card) => (
              <StatCard key={card.id} card={card} />
            ))}
          </div>

          {/* Schedule + Alerts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <TodayScheduleList items={todaySchedule} />
            </div>
            <div className="lg:col-span-1">
              <RecentAlerts alerts={recentAlerts} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
