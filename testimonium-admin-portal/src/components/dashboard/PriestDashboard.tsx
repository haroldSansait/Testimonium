import { useState, useEffect, useCallback } from 'react';
import { StatCard } from '@/components/dashboard/StatCard';
import { TodayScheduleList } from '@/components/dashboard/TodayScheduleList';
import { RecentAlerts } from '@/components/dashboard/RecentAlerts';
import { PriestMiniCalendar } from '@/components/dashboard/PriestMiniCalendar';
import { DashboardService } from '@/services/DashboardService';
import { useAuth } from '@/hooks/useAuth';
import { getScheduleRequests, respondPriestAssignment } from '@/services/scheduleRequestService';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { Check, XCircle } from 'lucide-react';
import type { StatCardData, TodayScheduleItem, RecentAlert, ScheduleRequest } from '@/types';

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
  const [pendingAssignments, setPendingAssignments] = useState<ScheduleRequest[]>([]);
  const [activeRespondId, setActiveRespondId] = useState<string | null>(null);
  const [respondAction, setRespondAction] = useState<'ACCEPTED' | 'REJECTED' | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { applicationUser } = useAuth();

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await getScheduleRequests({ filter: 'all', page: 1, pageSize: 100 });
      const currentUserId = applicationUser?.id ? String(applicationUser.id) : null;
      if (!currentUserId) {
        setPendingAssignments([]);
        return;
      }

      const pending = res.data.filter(r => {
        // Identity Hardening: Strictly require schedule.assignedPriestId === currentPriest.userId
        // Never use priest name, display name, or partial strings for identity decisions.
        const isAssignedToCurrentPriest = Boolean(r.assignedPriestId && String(r.assignedPriestId) === currentUserId);

        // Pending state: assignment has not reached terminal status (ACCEPTED or REJECTED)
        const isPendingResponse = r.priestResponseStatus !== 'ACCEPTED' && r.priestResponseStatus !== 'REJECTED';

        return isAssignedToCurrentPriest && isPendingResponse;
      });
      setPendingAssignments(pending);
    } catch (err) {
      console.error('Failed to load pending assignments:', err);
    }
  }, [applicationUser]);

  const loadDashboardData = useCallback(() => {
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

  // Set up visibility-aware 5-second polling, disabled when active action or submit is in progress
  useAutoRefresh(
    useCallback(async () => {
      await fetchAssignments();
      loadDashboardData();
    }, [fetchAssignments, loadDashboardData]),
    { intervalMs: 5000, enabled: activeRespondId === null && !isSubmitting }
  );

  useEffect(() => {
    loadDashboardData();
    void fetchAssignments();
  }, [loadDashboardData, fetchAssignments]);

  // Toast Auto-Dismissal
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const handleRespond = async (id: string, status: 'ACCEPTED' | 'REJECTED', reason?: string) => {
    setIsSubmitting(true);
    const originalPending = [...pendingAssignments];
    const assignment = originalPending.find((item) => item.id === id);
    
    // Optimistic UI update: remove item immediately from list
    setPendingAssignments(prev => prev.filter(item => item.id !== id));
    
    try {
      if (typeof assignment?.version !== 'number') {
        throw new Error('This assignment is missing its concurrency version. Refresh and try again.');
      }
      await respondPriestAssignment(id, status, reason, assignment.version);
      setToast({
        message: `Assignment ${status === 'ACCEPTED' ? 'accepted' : 'declined'} successfully.`,
        type: 'success',
      });
      loadDashboardData();
      setActiveRespondId(null);
      setRespondAction(null);
      setReasonText('');
    } catch (err) {
      console.error(err);
      // Rollback on error
      setPendingAssignments(originalPending);
      setToast({
        message: 'Failed to submit assignment response.',
        type: 'error',
      });
    } finally {
      setIsSubmitting(false);
      void fetchAssignments();
    }
  };

  return (
    <div className="space-y-6">
      {/* Page greeting */}
      <div>
        <h1
          className="text-4xl font-bold text-crimson-700"
          style={{ fontFamily: 'Playfair Display, serif' }}
        >
          {greeting}, Father
        </h1>
        <p className="text-gray-500 mt-1 text-sm">
          Here is today's pastoral schedule and pending sacramental requests.
        </p>
      </div>

      {/* Pending Assignments Alert/Action Section */}
      {pendingAssignments.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
          <div>
            <h3 className="font-semibold text-[#7B1C2A] text-base">Pending Pastoral Assignments</h3>
            <p className="text-xs text-gray-500 mt-0.5">Please accept or decline your assigned sacramental rituals.</p>
          </div>
          <div className="divide-y divide-gray-150">
            {pendingAssignments.map(item => (
              <div key={item.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[#7B1C2A] uppercase tracking-wide">{item.appointmentTitle || item.eventType}</span>
                    <span className="text-[10px] text-gray-400 font-mono">({item.referenceNo})</span>
                  </div>
                  <p className="text-sm font-semibold text-gray-800">{item.parishionerName}</p>
                  <p className="text-xs text-gray-500">
                    {item.preferredDate} at {item.preferredTime} • {item.parish || 'Main Church'}
                  </p>
                  {item.notes && <p className="text-xs text-gray-500 italic bg-gray-50 p-2.5 rounded-lg border border-gray-100 mt-1.5">"{item.notes}"</p>}
                </div>
                <div className="flex flex-col gap-2 w-full sm:w-auto">
                  {activeRespondId === item.id ? (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2 w-full sm:w-80 animate-in slide-in-from-top-1 duration-150">
                      <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        Note (Optional):
                      </label>
                      <textarea
                        value={reasonText}
                        onChange={(e) => setReasonText(e.target.value)}
                        placeholder={respondAction === 'REJECTED' ? "e.g., Conflicting pastoral duties, sick leave..." : "e.g., I will be there 15 minutes early..."}
                        className="w-full p-2 text-xs border border-gray-200 rounded-md outline-none focus:border-[#7B1C2A] bg-white font-medium text-gray-800 disabled:opacity-50"
                        rows={2}
                        disabled={isSubmitting}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveRespondId(null);
                            setRespondAction(null);
                            setReasonText('');
                          }}
                          className="px-2.5 py-1.5 border border-gray-200 bg-white hover:bg-gray-50 rounded-md text-[10px] font-bold text-gray-600 transition-colors disabled:opacity-50"
                          disabled={isSubmitting}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void handleRespond(item.id, respondAction!, reasonText);
                          }}
                          disabled={isSubmitting}
                          className={`px-3 py-1.5 text-white rounded-md text-[10px] font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                            respondAction === 'ACCEPTED' ? 'bg-emerald-700 hover:bg-emerald-800' : 'bg-red-700 hover:bg-red-800'
                          }`}
                        >
                          {isSubmitting
                            ? (respondAction === 'ACCEPTED' ? 'Accepting…' : 'Rejecting…')
                            : `Confirm ${respondAction === 'ACCEPTED' ? 'Accept' : 'Decline'}`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRespondId(item.id);
                          setRespondAction('ACCEPTED');
                          setReasonText('');
                        }}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                      >
                        Accept
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRespondId(item.id);
                          setRespondAction('REJECTED');
                          setReasonText('');
                        }}
                        className="px-4 py-2 bg-red-700 hover:bg-red-800 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stat Cards Grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <StatCard key={card.id} card={card} />
        ))}
      </div>

      {/* Schedule + Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <TodayScheduleList items={todaySchedule} />
        </div>
        <div className="lg:col-span-1 space-y-6">
          <PriestMiniCalendar />
          <RecentAlerts alerts={recentAlerts} />
        </div>
      </div>

      {/* Inline Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 ${
            toast.type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-4 h-4 flex-shrink-0" />
          ) : (
            <XCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.message}
        </div>
      )}
    </div>
  );
}
