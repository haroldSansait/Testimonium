import { useState, useEffect } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { TodayScheduleList } from '@/components/dashboard/TodayScheduleList';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { DashboardService } from '@/services/DashboardService';
import type { StatCardData, TodayScheduleItem, RecentAlert } from '@/types';

/**
 * PriestDashboard — same layout as SecretaryDashboard but with
 * pastoral-focused greeting copy tailored for the Priest role.
 *
 * Shares the same DashboardService data since both roles see
 * the same parish-level information.
 */
export function PriestDashboard() {
  const [statCards, setStatCards] = useState<StatCardData[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<TodayScheduleItem[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<RecentAlert[]>([]);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  useEffect(() => {
    void Promise.all([
      DashboardService.getStats(),
      DashboardService.getTodaySchedule(),
      DashboardService.getRecentAlerts(),
    ]).then(([stats, schedule, alerts]) => {
      setStatCards(stats);
      setTodaySchedule(schedule);
      setRecentAlerts(alerts);
    });
  }, []);

  return (
    <div className="space-y-6">
      {/* Page greeting */}
      <div>
        <h1
          className="text-4xl font-bold text-gray-900"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          {greeting}, Father
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here is today's pastoral schedule and pending sacramental requests.
        </p>
      </div>

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
    </div>
  );
}
