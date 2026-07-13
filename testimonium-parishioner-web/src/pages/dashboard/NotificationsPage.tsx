import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Check, 
  Inbox, 
  CheckSquare, 
  FilePlus, 
  XCircle, 
  CreditCard, 
  ShieldCheck, 
  Calendar, 
  CalendarCheck, 
  CalendarX 
} from 'lucide-react';
import { useNotifications } from '../../contexts/NotificationContext';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';
import type { TabItem } from '../../components/ui/Tabs';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import type { AppNotification } from '../../types';

export const NotificationsPage: React.FC = () => {
  const navigate = useNavigate();
  const { 
    notifications, 
    unreadCount, 
    loading,
    error,
    newlyArrivedIds,
    markAsRead,
    markAllAsRead,
    refresh
  } = useNotifications();

  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  const tabs: TabItem[] = [
    { id: 'all', label: 'All Notifications' },
    { id: 'unread', label: `Unread (${unreadCount})` },
  ];

  const filteredNotifications = notifications.filter(notif => {
    if (activeFilter === 'unread') return !notif.read;
    return true;
  });

  // Group notifications by date (Today, Yesterday, Earlier)
  const groupedNotifications = useMemo(() => {
    const today: AppNotification[] = [];
    const yesterday: AppNotification[] = [];
    const earlier: AppNotification[] = [];

    const now = new Date();
    const todayDateStr = now.toDateString();
    
    const yesterdayDate = new Date();
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayDateStr = yesterdayDate.toDateString();

    filteredNotifications.forEach(notif => {
      const notifDate = new Date(notif.createdAt);
      const notifDateStr = notifDate.toDateString();

      if (notifDateStr === todayDateStr) {
        today.push(notif);
      } else if (notifDateStr === yesterdayDateStr) {
        yesterday.push(notif);
      } else {
        earlier.push(notif);
      }
    });

    return [
      { title: 'Today', items: today },
      { title: 'Yesterday', items: yesterday },
      { title: 'Earlier', items: earlier }
    ].filter(group => group.items.length > 0);
  }, [filteredNotifications]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'document-submitted':
        return <FilePlus className="text-blue-600" size={18} />;
      case 'document-approved':
      case 'document-ready':
      case 'document-completed':
        return <CheckSquare className="text-emerald-600" size={18} />;
      case 'document-cancelled':
      case 'document-rejected':
        return <XCircle className="text-rose-600" size={18} />;
      case 'payment-requested':
        return <CreditCard className="text-amber-500" size={18} />;
      case 'payment-verified':
        return <ShieldCheck className="text-emerald-600" size={18} />;
      case 'appointment-submitted':
        return <Calendar className="text-blue-600" size={18} />;
      case 'appointment-confirmed':
        return <CalendarCheck className="text-emerald-600" size={18} />;
      case 'appointment-declined':
        return <CalendarX className="text-rose-600" size={18} />;
      case 'announcement':
        return <Bell className="text-purple-600" size={18} />;
      default:
        return <Inbox className="text-gray-500" size={18} />;
    }
  };

  const handleNotificationClick = async (notif: AppNotification) => {
    // Mark as read first if unread
    if (!notif.read) {
      await markAsRead(notif.id);
    }

    // Contextual navigation
    if (notif.referenceType === 'DOCUMENT_REQUEST' && notif.referenceId) {
      navigate(`/dashboard/track?requestId=${notif.referenceId}`);
    } else if (notif.referenceType === 'SCHEDULE_REQUEST') {
      navigate('/dashboard/home');
    }
  };

  return (
    <div className="space-y-6" aria-live="polite">
      {/* Visual highlight style definition */}
      <style>{`
        @keyframes highlight-pulse {
          0% { background-color: rgba(220, 38, 38, 0.1); border-left: 3px solid rgb(220, 38, 38); }
          50% { background-color: rgba(220, 38, 38, 0.03); border-left: 3px solid rgb(220, 38, 38); }
          100% { background-color: transparent; border-left: 3px solid transparent; }
        }
        .animate-highlight {
          animation: highlight-pulse 2s ease-in-out infinite;
        }
      `}</style>

      <PageHeader 
        title="Notification Center" 
        description="Monitor status updates for requested documents, schedules, and diocesan announcements."
        onRefresh={refresh}
        isRefreshing={loading}
        breadcrumbs={['Home', 'Notifications']}
        action={
          unreadCount > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllAsRead} className="flex items-center space-x-1 focus-ring">
              <Check size={14} />
              <span>Mark All Read</span>
            </Button>
          ) : undefined
        }
      />

      {error ? (
        <ErrorState 
          title="Unable to load notifications" 
          description="We had trouble retrieving your alerts from the server. Please check your internet connection."
          onRetry={refresh} 
        />
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-6">
            <Tabs 
              tabs={tabs} 
              activeTab={activeFilter} 
              onChange={(id) => setActiveFilter(id as any)} 
            />

            {loading && notifications.length === 0 ? (
              <div className="space-y-4" aria-busy="true">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-start space-x-4 p-2">
                    <Skeleton className="w-2.5 h-2.5 rounded-full mt-2" />
                    <Skeleton className="w-10 h-10 rounded-button" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/4 rounded" />
                      <Skeleton className="h-3 w-3/4 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredNotifications.length === 0 ? (
              <EmptyState
                title="You're all caught up!"
                description={
                  activeFilter === 'unread' 
                    ? "No new notifications found in your inbox. Check back later for canonical registry updates."
                    : "No notifications logged. Important document confirmations and interview updates will appear here."
                }
                icon={<Bell size={40} className="text-text-muted/40" />}
              />
            ) : (
              <div className="space-y-8">
                {groupedNotifications.map(group => (
                  <div key={group.title} className="space-y-3">
                    <h3 className="text-xs font-bold text-text-muted/70 uppercase tracking-widest pl-2 border-l-2 border-crimson">
                      {group.title}
                    </h3>
                    <div className="divide-y divide-border/60">
                      {group.items.map(notif => {
                        const isNew = newlyArrivedIds.includes(notif.id);
                        return (
                          <div 
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`py-4 flex items-start justify-between group transition-colors rounded-button px-2 -mx-2 cursor-pointer ${
                              isNew 
                                ? 'animate-highlight' 
                                : !notif.read 
                                  ? 'bg-red-50/5' 
                                  : 'hover:bg-app-page/40'
                            }`}
                          >
                            <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                              {/* Unread Indicator */}
                              <div className="pt-1.5 flex-shrink-0">
                                {!notif.read ? (
                                  <span className="block w-2 h-2 bg-crimson rounded-full" aria-label="Unread" />
                                ) : (
                                  <span className="block w-2 h-2 bg-transparent" />
                                )}
                              </div>

                              {/* Icon */}
                              <div className="p-2 bg-app-page rounded-button border border-border/40 flex-shrink-0">
                                {getNotificationIcon(notif.type)}
                              </div>

                              {/* Text */}
                              <div className="space-y-1 flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <h4 className={`text-sm ${!notif.read ? 'font-semibold text-text-primary' : 'text-text-muted'}`}>
                                    {notif.title}
                                  </h4>
                                  <span className="text-[10px] text-text-muted">
                                    {new Date(notif.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </div>
                                <p className="text-xs text-text-muted leading-relaxed">
                                  {notif.message}
                                </p>
                              </div>
                            </div>

                            {/* Hover Actions */}
                            <div className="ml-4 flex items-center space-x-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notif.read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markAsRead(notif.id);
                                  }}
                                  className="p-1 rounded-full hover:bg-border/60 text-text-muted hover:text-text-primary focus-ring"
                                  title="Mark as read"
                                >
                                  <Check size={16} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default NotificationsPage;
