import { useDashboardPreload } from '@/hooks/useDashboardPreload';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import {
  Info,
  AlertTriangle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { Avatar } from '@/components/ui/Avatar';
import { DioceseDashboardService } from '@/services/DioceseDashboardService';
import { StatCard } from '@/components/dashboard/StatCard';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import type { DioceseActivity, DioceseNotification, StatCardData } from '@/types';

// ─── Shared Detail Modal for Activity ─────────────────────────────────────────

interface ActivityDetailModalProps {
  activity: DioceseActivity;
  onClose: () => void;
}

function ActivityDetailModal({ activity, onClose }: ActivityDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
          <Avatar initials={activity.actorInitials} bgColor={activity.actorColor} size="md" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Activity Log Details
        </h3>
        <p className="text-xs text-gray-400 mb-4">{activity.timeAgo}</p>

        <div className="text-sm text-left space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-100 mb-6">
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Performed By</span>
            <p className="font-semibold text-gray-900 mt-0.5">{activity.actor}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Action Description</span>
            <p className="text-gray-700 mt-0.5">{activity.action}</p>
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Parish Location</span>
            <p className="text-gray-700 mt-0.5">{activity.parish}</p>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-800 text-white text-sm font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Diocese Activity Feed ────────────────────────────────────────────────────

interface ActivityFeedProps {
  items: DioceseActivity[];
  onRowClick?: (item: DioceseActivity) => void;
}

function ActivityFeed({ items, onRowClick }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6 text-center">
        <p className="text-sm text-gray-500">No recent activity logs found.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="px-5 pt-5 pb-2">
        <h3 className="font-semibold text-gray-900 text-base">Recent Diocese Activity</h3>
      </div>
      <ul className="px-5 pb-4 space-y-0">
        {items.map((item) => (
          <li
            key={item.id}
            onClick={() => onRowClick?.(item)}
            className="flex items-start gap-3 py-3.5 border-b border-gray-100 last:border-b-0 cursor-pointer hover:bg-gray-50/50 px-2 rounded-lg transition-colors"
          >
            <Avatar
              initials={item.actorInitials}
              bgColor={item.actorColor}
              size="sm"
              className="mt-0.5 flex-shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-900">
                <span className="font-semibold">{item.actor}</span>
                {' '}
                <span className="text-gray-600">{item.action}</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {item.parish} · {item.timeAgo}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Diocese Notifications ────────────────────────────────────────────────────

const notifConfig = {
  info:    { icon: <Info className="w-4 h-4 text-blue-500" />,    bg: 'bg-blue-50',   border: 'border-blue-100' },
  warning: { icon: <AlertTriangle className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-50', border: 'border-amber-100' },
  success: { icon: <CheckCircle className="w-4 h-4 text-green-500" />, bg: 'bg-green-50', border: 'border-green-100' },
} as const;

interface DioceseNotificationsProps {
  items: DioceseNotification[];
}

function DioceseNotifications({ items }: DioceseNotificationsProps) {
  const navigate = useNavigate();

  const handleNotificationClick = (notif: DioceseNotification) => {
    const titleLower = notif.title.toLowerCase();
    const bodyLower = notif.body.toLowerCase();

    if (titleLower.includes('document') || bodyLower.includes('request')) {
      navigate('/document-requests');
    } else if (titleLower.includes('report') || bodyLower.includes('statistics') || bodyLower.includes('sacrament')) {
      navigate('/analytics');
    } else if (titleLower.includes('parish') || bodyLower.includes('onboarded')) {
      navigate('/parish-management');
    } else if (titleLower.includes('secretary') || titleLower.includes('unassigned') || bodyLower.includes('secretary')) {
      navigate('/user-management');
    } else {
      navigate('/notifications');
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-card p-6 text-center">
        <p className="text-sm text-gray-500">No diocese alerts or notifications.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="px-5 pt-5 pb-3">
        <h3 className="font-semibold text-gray-900 text-base mb-3">Diocese Notifications</h3>
        <div className="space-y-2">
          {items.map((notif) => {
            const cfg = notifConfig[notif.type];
            return (
              <div
                key={notif.id}
                onClick={() => handleNotificationClick(notif)}
                className={cn('flex gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50/10 transition-colors', cfg.bg, cfg.border)}
              >
                <div className="flex-shrink-0 mt-0.5">{cfg.icon}</div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                  <p className="text-xs text-gray-505 mt-0.5 leading-relaxed">{notif.body}</p>
                  <p className="text-xs text-gray-400 mt-1.5">{notif.timeAgo}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── DioceseDashboard (main) ─────────────────────────────────────────────────

export function DioceseDashboard() {
  const [selectedActivity, setSelectedActivity] = useState<DioceseActivity | null>(null);
  const dashboard = useCachedQuery(['diocese'], async () => {
    const [stats, activity, notifications] = await Promise.all([
      DioceseDashboardService.getStats(), DioceseDashboardService.getRecentActivity(), DioceseDashboardService.getNotifications(),
    ]);
    return { stats, activity, notifications };
  }, { enabled: !selectedActivity });
  const stats = dashboard.data?.stats ?? [];
  const activity = dashboard.data?.activity ?? [];
  const notifications = dashboard.data?.notifications ?? [];
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
      {/* Greeting */}
      <div>
        <h1
          className="text-4xl font-bold text-crimson-700"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          {greeting}
        </h1>
        <p className="text-gray-505 mt-1 text-sm">
          Diocese-wide overview — all parishes, personnel, and pending requests at a glance.
        </p>
      </div>

      {isLoading ? (
        <LoadingState message="Loading dashboard statistics..." />
      ) : error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <>
          {/* KPI Grid ── 4 columns on xl, 2 on md, 1 on sm */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => (
              <StatCard key={stat.id} card={stat as unknown as StatCardData} />
            ))}
          </div>

          {/* Activity feed + Notifications */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ActivityFeed items={activity} onRowClick={setSelectedActivity} />
            </div>
            <div className="lg:col-span-1">
              <DioceseNotifications items={notifications} />
            </div>
          </div>
        </>
      )}

      {/* Activity Details Modal */}
      {selectedActivity && (
        <ActivityDetailModal
          activity={selectedActivity}
          onClose={() => setSelectedActivity(null)}
        />
      )}
    </div>
  );
}
