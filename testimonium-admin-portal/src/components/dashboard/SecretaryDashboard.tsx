import { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { TodayScheduleList } from '@/components/dashboard/TodayScheduleList';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { DashboardService } from '@/services/DashboardService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { StatCardData, TodayScheduleItem, RecentAlert } from '@/types';

/**
 * SecretaryDashboard — parish-level view with pending requests,
 * today's schedule, and recent alerts.
 *
 * Extracted from the original DashboardPage so it can be rendered
 * by the role-router in DashboardPage while keeping its own data-fetching logic.
 */
export function SecretaryDashboard() {
  const [statCards, setStatCards] = useState<StatCardData[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<TodayScheduleItem[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const loadData = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const [stats, schedule, alerts] = await Promise.all([
        DashboardService.getStats(),
        DashboardService.getTodaySchedule(),
        DashboardService.getRecentAlerts(),
      ]);
      setStatCards(stats);
      setTodaySchedule(schedule);
      setRecentAlerts(alerts);
    } catch (err: any) {
      console.error('Failed to load Secretary dashboard data:', err);
      if (!silent) {
        setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadData(false);
  }, [loadData]);

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
          className="text-4xl font-bold text-gray-900"
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
