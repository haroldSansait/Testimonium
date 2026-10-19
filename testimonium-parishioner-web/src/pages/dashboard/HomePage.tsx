import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FileText,
  Search,
  Calendar,
  Map,
  ArrowRight,
  Clock,
  ExternalLink,
  MessageSquare,
  Inbox,
  Bell,
  Building,
  CalendarDays,
  User as UserIcon,
  CalendarPlus,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { resolveFirstName } from '../../utils/nameHelpers';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
import { CustomSelect } from '../../components/ui/CustomSelect';
import {
  useParishes,
  useRequests,
  useAppointments,
  useProfile,
  useEvents,
  useFeaturedEvents
} from '../../hooks/useService';
import type { Event } from '../../types';
import {
  getEventCountdownLabel,
  isEventUpcoming,
  isEventInRolling7Days,
  getManilaCalendarDate,
  isWindowCrossMonth,
  formatEventCalendarDate,
  parseEventDateTime,
} from '../../utils/date';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { ErrorState } from '../../components/ui/ErrorState';
import { PageHeader } from '../../components/ui/PageHeader';
import { SectionHeader } from '../../components/ui/SectionHeader';
import { LeafletMap } from '../../components/maps/LeafletMap';
import { ParishMarker } from '../../features/parishes/components/ParishMarker';
import { FeaturedEventsCarousel } from '../../features/events/components/FeaturedEventsCarousel';
import { EventDetailsModal } from '../../features/events/components/EventDetailsModal';

const getBadgeVariant = (status: any): 'pending' | 'under-review' | 'ready' | 'rejected' | 'neutral' | 'crimson' | 'correction' => {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'under-review':
      return 'under-review';
    case 'ready':
    case 'completed':
      return 'ready';
    case 'rejected':
    case 'cancelled':
    case 'expired':
      return 'rejected';
    case 'needs-correction':
    case 'needs_correction':
    case 'payment-needs-correction':
      return 'correction';
    default:
      return 'under-review';
  }
};

const exportToGoogleCalendar = (appt: any, parishName: string) => {
  const title = encodeURIComponent(appt.serviceName);
  const details = encodeURIComponent(`Testimonium Parish Appointment\nParish: ${parishName}\nConfirmation: ${appt.confirmationNumber || appt.id}`);
  const locationStr = encodeURIComponent(parishName);

  const dateObj = new Date(`${appt.date}T${appt.timeSlot.includes('AM') ? '09:00:00' : '14:00:00'}`);
  const startStr = dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  dateObj.setHours(dateObj.getHours() + 1);
  const endStr = dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const url = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startStr}/${endStr}&details=${details}&location=${locationStr}`;
  window.open(url, '_blank');
};

const exportToICS = (appt: any, parishName: string) => {
  const dateObj = new Date(`${appt.date}T${appt.timeSlot.includes('AM') ? '09:00:00' : '14:00:00'}`);
  const startStr = dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  dateObj.setHours(dateObj.getHours() + 1);
  const endStr = dateObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Testimonium//NONSGML Calendar//EN',
    'BEGIN:VEVENT',
    `UID:${appt.id}@testimonium.app`,
    `DTSTAMP:${startStr}`,
    `DTSTART:${startStr}`,
    `DTEND:${endStr}`,
    `SUMMARY:${appt.serviceName}`,
    `DESCRIPTION:Parish: ${parishName}\\nConfirmation Number: ${appt.confirmationNumber || appt.id}`,
    `LOCATION:${parishName}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${appt.serviceName.replace(/\s+/g, '_')}_Appointment.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const HomePage: React.FC = () => {
  const { user, appProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Core Queries (Top-level unconditional hook execution)
  const parishesQuery = useParishes();
  const requestsQuery = useRequests();
  const appointmentsQuery = useAppointments();
  const profileQuery = useProfile(user?.uid || '');
  const eventsQuery = useEvents();
  const featuredEventsQuery = useFeaturedEvents();

  // Filter States
  const [filterParishId, setFilterParishId] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { isProfileIncomplete, requireCompleteProfile } = useProfileRequirement();

  const isRegistrationSession =
    typeof window !== 'undefined' && sessionStorage.getItem('testimonium_registration_session') === 'true';
  const firstName = resolveFirstName(appProfile?.fullName, profileQuery.data?.displayName || user?.displayName);

  // Safe data extractions (handle loading / error / undefined states gracefully)
  const requests = requestsQuery.data || [];
  const appointments = appointmentsQuery.data || [];
  const parishes = parishesQuery.data || [];
  const profile = profileQuery.data;
  const events = eventsQuery.data || [];

  // Deduplicated candidate events retrieved for current Manila month
  const rawFeaturedCandidates = useMemo(() => {
    const featuredList = featuredEventsQuery.data || [];
    const candidateDict: Record<string, Event> = {};
    featuredList.forEach(e => { candidateDict[e.id] = e; });
    return Object.values(candidateDict);
  }, [featuredEventsQuery.data]);

  // Count strictly upcoming candidate events in current month before user filters
  const upcomingCandidatesCount = useMemo(() => {
    return rawFeaturedCandidates.filter(e => isEventUpcoming(e)).length;
  }, [rawFeaturedCandidates]);

  // Count raw upcoming candidate events within rolling 7-day window before user filters & consolidation
  const weeklyCandidateCount = useMemo(() => {
    return rawFeaturedCandidates.filter(e => isEventInRolling7Days(e)).length;
  }, [rawFeaturedCandidates]);

  // Contextual empty-state copy classification
  const featuredEmptyStateConfig = useMemo(() => {
    // Situation B: No events scheduled this month at all
    if (rawFeaturedCandidates.length === 0) {
      return {
        title: 'No upcoming events are scheduled for this month.',
        description: 'There are currently no events or scheduled Masses posted for this month.',
        showClearFilters: false,
      };
    }

    // Situation C: Current-month events existed, but all have concluded
    if (upcomingCandidatesCount === 0) {
      return {
        title: 'All events for this month have concluded.',
        description: 'Check back next month for upcoming parish events and Mass schedules.',
        showClearFilters: false,
      };
    }

    // Situation D: Future events exist this month, but none fall within the rolling weekly window
    if (weeklyCandidateCount === 0) {
      const todayStr = getManilaCalendarDate();
      const isCrossMonth = isWindowCrossMonth(todayStr, 7);
      if (isCrossMonth) {
        return {
          title: 'No upcoming events are posted for the remaining days of this month.',
          description: 'Check back next month or visit the Parish Directory for future schedules.',
          showClearFilters: false,
        };
      }
      return {
        title: 'No upcoming events in the next 7 days.',
        description: 'Check the Parish Directory for upcoming events scheduled later this month.',
        showClearFilters: false,
      };
    }

    // Situation E: Weekly candidates exist, but active filters eliminated them
    return {
      title: 'No events match your current filters.',
      description: 'Try selecting a different parish or event category to see available schedules in the next 7 days.',
      showClearFilters: true,
    };
  }, [rawFeaturedCandidates.length, upcomingCandidatesCount, weeklyCandidateCount]);

  // Filter featured events according to rolling 7-day window & user selections
  const filteredFeaturedEvents = useMemo(() => {
    if (rawFeaturedCandidates.length === 0) return [];

    const validUpcoming = rawFeaturedCandidates.filter(e => {
      if (!isEventInRolling7Days(e)) return false;
      if (filterParishId !== 'all' && String(e.parishId).trim() !== String(filterParishId).trim()) return false;
      if (filterCategory !== 'all' && e.category.toLowerCase() !== filterCategory.toLowerCase()) return false;
      return true;
    });

    // Consolidate multiple Mass entries on the same parish & date
    const nonMassEvents: Event[] = [];
    const massMap: Record<string, Event[]> = {};

    validUpcoming.forEach(e => {
      if (e.category === 'Holy Mass') {
        const key = `${String(e.parishId)}_${e.startDate}`;
        if (!massMap[key]) massMap[key] = [];
        massMap[key].push(e);
      } else {
        nonMassEvents.push(e);
      }
    });

    const consolidatedMasses: Event[] = Object.values(massMap).map(massList => {
      if (massList.length === 1) return massList[0];
      const sorted = [...massList].sort((a, b) => (parseEventDateTime(a.startDate, a.startTime)?.getTime() || 0) - (parseEventDateTime(b.startDate, b.startTime)?.getTime() || 0));
      const firstUpcoming = sorted[0];
      const allTimes = sorted.map(m => m.startTime).filter(Boolean).join(' • ');
      return {
        ...firstUpcoming,
        title: `${firstUpcoming.parishName} Holy Mass Schedule`,
        description: `Mass schedule times: ${allTimes}. Join our parish community for holy sacrifice and prayers.`,
        startTime: firstUpcoming.startTime,
        endTime: sorted[sorted.length - 1].endTime || firstUpcoming.endTime,
      };
    });

    return [...nonMassEvents, ...consolidatedMasses].sort((a, b) => {
      const startDifference = (parseEventDateTime(a.startDate, a.startTime)?.getTime() || 0)
        - (parseEventDateTime(b.startDate, b.startTime)?.getTime() || 0);
      return startDifference || a.id.localeCompare(b.id);
    });
  }, [rawFeaturedCandidates, filterParishId, filterCategory]);

  // Filter next event assigned to user's local parish (strictly upcoming events)
  const nextParishEvent = profile?.parishId
    ? events.find(e => String(e.parishId).trim() === String(profile.parishId).trim() && isEventUpcoming(e))
    : undefined;

  const loading =
    parishesQuery.loading ||
    requestsQuery.loading ||
    appointmentsQuery.loading ||
    profileQuery.loading ||
    eventsQuery.loading ||
    featuredEventsQuery.loading;

  const error =
    parishesQuery.error ||
    requestsQuery.error ||
    appointmentsQuery.error ||
    profileQuery.error ||
    eventsQuery.error ||
    featuredEventsQuery.error;

  const refetchAll = () => {
    parishesQuery.refetch();
    requestsQuery.refetch();
    appointmentsQuery.refetch();
    profileQuery.refetch();
    eventsQuery.refetch();
    featuredEventsQuery.refetch();
  };

  const handleViewEventDetails = (event: Event) => {
    setSelectedEvent(event);
    setIsModalOpen(true);
  };

  const handleViewParishFromEvent = (parishId: string) => {
    setIsModalOpen(false);
    navigate(`/dashboard/parishes?parishId=${parishId}`);
  };

  const quickActions = [
    { label: 'Request Document', path: '/dashboard/request', icon: <FileText size={18} />, description: 'Baptism, confirmation, or marriage records.', type: 'service' },
    { label: 'Track Request', path: '/dashboard/track', icon: <Search size={18} />, description: 'Monitor submitted documents in real time.', type: 'service' },
    { label: 'Schedule Appointment', path: '/dashboard/scheduler', icon: <Calendar size={18} />, description: 'Book canonical interviews or blessings.', type: 'service' },
    { label: 'Parish Directory', path: '/dashboard/parishes', icon: <Map size={18} />, description: 'Find parish offices, contacts, and schedules.', type: 'service' },
    { label: 'Notifications', path: '/dashboard/notifications', icon: <Bell size={18} />, description: 'View system alerts and diocese notices.', type: 'account' },
    { label: 'My Profile', path: '/dashboard/profile', icon: <UserIcon size={18} />, description: 'Update contact details and preferences.', type: 'account' },
  ];

  const getParishName = (parishId: string) => {
    return parishes.find(p => p.id === parishId)?.name || 'Local Parish';
  };

  if (error) {
    return (
      <div className="space-y-6 text-left">
        <PageHeader
          title="Home"
          description="TESTIMONIUM parishioner overview portal."
          showBackToHome={false}
          onRefresh={refetchAll}
          breadcrumbs={['Home']}
        />
        <ErrorState
          title="Failed to load dashboard data"
          description="We had trouble retrieving your dashboard feed. Please check your connection and try again."
          onRetry={refetchAll}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-8 pb-10 text-left" aria-busy="true">
        <PageHeader
          title="Home"
          description="Overview of your sacramental requests, appointments, and vicariate events."
          showBackToHome={false}
          onRefresh={refetchAll}
          isRefreshing={true}
          breadcrumbs={['Home']}
        />

        {/* Welcome Banner Skeleton */}
        <Skeleton className="h-44 w-full rounded-card" />

        {/* Carousel Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-48 rounded" />
          <div className="h-[380px] w-full rounded-card overflow-hidden bg-white border border-border flex flex-col md:flex-row shadow-sm">
            <Skeleton className="w-full md:w-5/12 h-48 md:h-full" />
            <div className="flex-1 p-6 md:p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/4 rounded" />
                <Skeleton className="h-8 w-3/4 rounded" />
                <Skeleton className="h-4 w-1/2 rounded" />
                <Skeleton className="h-16 w-full rounded" />
              </div>
              <Skeleton className="h-10 w-28 rounded-button" />
            </div>
          </div>
        </div>

        {/* Quick Access Skeleton */}
        <div className="space-y-4">
          <Skeleton className="h-5 w-32 rounded" />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-36 w-full rounded-card" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10 text-left" aria-live="polite">
      <PageHeader
        title="Home"
        description="Overview of your sacramental requests, appointments, and vicariate events."
        showBackToHome={false}
        onRefresh={refetchAll}
        breadcrumbs={['Home']}
      />

      {/* Welcome Card Banner */}
      <Card className="bg-gradient-to-r from-[#6B0F1A] to-[#4A0A12] text-white border-none p-6 sm:p-8 md:p-10 shadow-md relative overflow-hidden">
        <div className="relative z-10 space-y-3 max-w-2xl text-left">
          <span className="text-[11px] font-bold text-white/75 uppercase tracking-widest block">
            Diocese of San Carlos • Vicariate of Canlaon
          </span>
          <h2 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-white leading-tight">
            {authLoading ? (
              <span className="inline-block h-8 w-48 bg-white/20 rounded animate-pulse" />
            ) : isRegistrationSession ? (
              firstName ? `Welcome, ${firstName}!` : 'Welcome!'
            ) : (
              firstName ? `Welcome back, ${firstName}!` : 'Welcome back!'
            )}
          </h2>
          <p className="text-xs sm:text-sm text-white/85 leading-relaxed font-normal">
            Manage document requests, schedule canonical appointments, and explore parish records across the Vicariate of Canlaon.
          </p>
          {isProfileIncomplete && (
            <div className="pt-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/10 backdrop-blur-sm p-3.5 rounded-lg border border-white/20">
                <div className="flex items-center gap-2 text-white">
                  <AlertCircle className="w-5 h-5 text-amber-300 shrink-0" />
                  <p className="text-xs sm:text-sm font-medium text-white/95">
                    Complete your profile to access document and schedule requests.
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard/profile')}
                  className="px-4 py-2 bg-white text-crimson hover:bg-gray-100 font-bold rounded-button text-xs shadow-sm transition-all active:scale-[0.98] focus-ring shrink-0"
                >
                  Complete Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Upcoming Vicariate Events Carousel */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h2 className="text-xs font-bold text-text-primary uppercase tracking-widest">
              Upcoming Vicariate Events
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <div className="w-[180px]">
              <CustomSelect
                value={filterParishId}
                onChange={setFilterParishId}
                placeholder="All Parishes"
                aria-label="Filter events by parish"
                options={[
                  { value: 'all', label: 'All Parishes' },
                  ...parishes.map((p) => ({ value: p.id, label: p.name })),
                ]}
                searchable
                searchPlaceholder="Search parish..."
              />
            </div>

            <div className="w-[170px]">
              <CustomSelect
                value={filterCategory}
                onChange={setFilterCategory}
                placeholder="All Categories"
                aria-label="Filter events by category"
                groups={[
                  {
                    options: [{ value: 'all', label: 'All Categories' }],
                  },
                  {
                    groupName: 'Sacraments & Rites',
                    options: [
                      { value: 'baptism', label: 'Baptism' },
                      { value: 'wedding', label: 'Wedding' },
                      { value: 'confirmation', label: 'Confirmation' },
                      { value: 'funeral', label: 'Funeral' },
                    ],
                  },
                  {
                    groupName: 'Masses & Celebrations',
                    options: [
                      { value: 'holy mass', label: 'Holy Mass' },
                      { value: 'fiesta', label: 'Fiesta' },
                      { value: 'seminar', label: 'Seminar' },
                      { value: 'other', label: 'Other' },
                    ],
                  },
                ]}
              />
            </div>

            <button
              onClick={() => navigate('/dashboard/parishes')}
              className="text-xs font-bold text-crimson hover:underline flex items-center gap-1 focus-ring ml-auto sm:ml-2 px-2 py-1 rounded"
            >
              <span>Directory</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>

        {filteredFeaturedEvents.length === 0 ? (
          <EmptyState
            title={featuredEmptyStateConfig.title}
            description={featuredEmptyStateConfig.description}
            icon={<CalendarDays size={36} className="text-text-muted/40" />}
            action={
              featuredEmptyStateConfig.showClearFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setFilterParishId('all');
                    setFilterCategory('all');
                  }}
                  className="text-xs font-semibold mt-2"
                >
                  Clear Filters
                </Button>
              ) : undefined
            }
          />
        ) : (
          <FeaturedEventsCarousel
            events={filteredFeaturedEvents}
            onViewDetails={handleViewEventDetails}
          />
        )}
      </div>

      {/* Happening at Your Parish */}
      {nextParishEvent && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-text-primary uppercase tracking-widest">
            Happening at Your Parish
          </h2>
          <Card className="bg-white border border-border/80 shadow-sm p-5 hover:shadow-card transition-shadow">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/40 pb-3 mb-4 space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <Building size={16} className="text-crimson" />
                <span className="text-xs font-semibold text-text-primary">{nextParishEvent.parishName}</span>
              </div>
              <div className="bg-red-50 text-crimson text-[10px] font-bold uppercase tracking-wider py-0.5 px-2.5 rounded-full border border-crimson/15">
                {getEventCountdownLabel(nextParishEvent.startDate)}
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:space-x-5 space-y-3 sm:space-y-0">
              <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0 bg-border">
                <img 
                  src={nextParishEvent.coverImage} 
                  alt={nextParishEvent.coverImageAlt} 
                  loading="lazy"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover" 
                />
              </div>
              <div className="flex-1 space-y-2">
                <h4 className="font-serif font-bold text-sm sm:text-base text-text-primary leading-snug">
                  {nextParishEvent.title}
                </h4>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-muted">
                  <span>{formatEventCalendarDate(nextParishEvent.startDate, { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>{nextParishEvent.startTime}</span>
                </div>
                <Button size="sm" onClick={() => handleViewEventDetails(nextParishEvent)} className="mt-1">
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Unified Quick Access Grid (All 6 Destinations) */}
      <section aria-label="Quick Access Services">
        <SectionHeader
          title="Quick Access"
          description="Choose a parish service or manage your account."
        />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 sm:gap-5">
          {quickActions.map(action => {
            const isProtectedAction =
              action.path === '/dashboard/request' || action.path === '/dashboard/scheduler';
            const handleClick = (e: React.MouseEvent) => {
              if (isProtectedAction) {
                e.preventDefault();
                requireCompleteProfile(
                  () => navigate(action.path),
                  action.path === '/dashboard/request' ? 'request certificates' : 'schedule appointments'
                );
              }
            };

            return (
              <Link
                key={action.path}
                to={action.path}
                onClick={handleClick}
                className={`rounded-card border p-4 sm:p-5 h-36 sm:h-40 flex flex-col justify-between transition-all hover:shadow-card hover:border-crimson/40 focus-ring group ${
                  action.type === 'service' ? 'bg-white border-border' : 'bg-app-page/60 border-border/80'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 sm:p-2.5 rounded-button w-fit ${
                    action.type === 'service' ? 'bg-red-50 text-crimson' : 'bg-gray-100 text-text-muted'
                  }`}>
                    {action.icon}
                  </div>
                  <ChevronRight size={14} className="text-text-muted/50 group-hover:text-crimson group-hover:translate-x-0.5 transition-transform" />
                </div>
                <div className="space-y-0.5">
                  <h3 className="font-serif font-bold text-text-primary text-xs sm:text-sm truncate group-hover:text-crimson transition-colors">
                    {action.label}
                  </h3>
                  <p className="text-[11px] text-text-muted line-clamp-2 leading-tight">
                    {action.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Core Grid: Left Column for Recent Requests & Appointments, Right for Map Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Recent Sacramental Requests */}
          <Card>
            <CardHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
                <Clock size={17} className="text-crimson" />
                <span>Recent Sacramental Requests</span>
              </CardTitle>
              {requests.length > 0 && (
                <button
                  onClick={() => navigate('/dashboard/track')}
                  className="text-xs font-bold text-crimson hover:underline flex items-center gap-1 focus-ring rounded px-1"
                >
                  <span>View All</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </CardHeader>
            <CardContent className="pt-3.5 space-y-3">
              {requests.length === 0 ? (
                <EmptyState
                  title="No document requests yet"
                  description="Your submitted certificate requests will appear here once you submit a request."
                  icon={<Inbox size={32} className="text-text-muted/40" />}
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        requireCompleteProfile(
                          () => navigate('/dashboard/request'),
                          'request certificates'
                        );
                      }}
                    >
                      Request a Document
                    </Button>
                  }
                />
              ) : (
                requests.slice(0, 3).map(req => (
                  <Link
                    key={req.id}
                    to={`/dashboard/track?requestId=${req.id}`}
                    className="p-3 bg-app-page hover:bg-border/30 rounded-button border border-border/70 transition-colors flex justify-between items-center gap-3 focus-ring group"
                  >
                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <FileText size={14} className="text-crimson flex-shrink-0" />
                        <span className="text-xs font-mono font-bold text-text-primary truncate group-hover:text-crimson transition-colors">
                          {req.trackingNumber}
                        </span>
                        <span className="text-text-muted text-xs">•</span>
                        <span className="text-[11px] font-semibold text-text-muted uppercase truncate">
                          {req.documentType}
                        </span>
                      </div>
                      <p className="text-xs text-text-muted truncate">
                        Parish: {getParishName(req.parishId)}
                      </p>
                    </div>
                    <Badge variant={getBadgeVariant(req.status)}>
                      {req.status}
                    </Badge>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>


          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="border-b border-border pb-3 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2 text-sm sm:text-base">
                <Calendar size={17} className="text-crimson" />
                <span>Upcoming Appointments</span>
              </CardTitle>
              {appointments.length > 0 && (
                <button
                  onClick={() => {
                    requireCompleteProfile(
                      () => navigate('/dashboard/scheduler'),
                      'schedule appointments'
                    );
                  }}
                  className="text-xs font-bold text-crimson hover:underline flex items-center gap-1 focus-ring rounded px-1"
                >
                  <span>Book New</span>
                  <ArrowRight size={13} />
                </button>
              )}
            </CardHeader>
            <CardContent className="pt-3.5 space-y-3">
              {appointments.length === 0 ? (
                <EmptyState
                  title="No appointments scheduled"
                  description="Book a blessing, counseling session, or sacramental interview with your parish priest."
                  icon={<Calendar size={32} className="text-text-muted/40" />}
                  action={
                    <Button
                      size="sm"
                      onClick={() => {
                        requireCompleteProfile(
                          () => navigate('/dashboard/scheduler'),
                          'schedule appointments'
                        );
                      }}
                    >
                      Schedule Appointment
                    </Button>
                  }
                />
              ) : (
                appointments.slice(0, 3).map(appt => (
                  <div
                    key={appt.id}
                    onClick={() => navigate(`/dashboard/schedule/${appt.id}`)}
                    className="p-3 bg-app-page hover:bg-border/30 rounded-button border border-border/70 transition-colors flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 cursor-pointer focus-ring group"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/dashboard/schedule/${appt.id}`);
                      }
                    }}
                  >
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-bold text-text-primary group-hover:text-crimson transition-colors">
                        {appt.serviceName}
                      </h4>
                      <p className="text-xs text-text-muted">
                        {getParishName(appt.parishId)} • {appt.date} at {appt.timeSlot}
                      </p>
                      <div className="flex flex-wrap gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportToGoogleCalendar(appt, getParishName(appt.parishId));
                          }}
                          className="px-2 py-0.5 text-[11px] font-semibold text-crimson bg-red-50 hover:bg-red-100 rounded border border-crimson/20 flex items-center gap-1 focus-ring"
                        >
                          <CalendarPlus size={11} /> Google Cal
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            exportToICS(appt, getParishName(appt.parishId));
                          }}
                          className="px-2 py-0.5 text-[11px] font-semibold text-crimson bg-red-50 hover:bg-red-100 rounded border border-crimson/20 flex items-center gap-1 focus-ring"
                        >
                          <CalendarPlus size={11} /> iCal / .ics
                        </button>
                      </div>
                    </div>
                    <Badge variant="ready" className="self-start sm:self-center">
                      {appt.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          {/* Vicariate Map Preview */}
          <Card className="overflow-hidden p-0 border border-border">
            <div className="p-4 border-b border-border bg-white flex items-center justify-between">
              <h3 className="font-serif font-bold text-text-primary text-sm flex items-center gap-1.5">
                <Map size={16} className="text-crimson" />
                <span>Vicariate Map</span>
              </h3>
            </div>

            <div className="h-64 sm:h-72 w-full relative bg-gray-100">
              {parishes.length > 0 ? (
                <LeafletMap center={{ lat: 10.22, lng: 123.25 }} zoom={9} className="h-full w-full">
                  {parishes.map(p => (
                    <ParishMarker key={p.id} parish={p} position={p.coordinates} />
                  ))}
                </LeafletMap>
              ) : (
                <Skeleton className="h-full w-full" />
              )}
            </div>

            <div className="p-3.5 bg-white border-t border-border">
              <Button
                size="sm"
                onClick={() => navigate('/dashboard/parishes')}
                className="w-full flex items-center justify-center gap-1.5 text-xs font-semibold"
              >
                <span>Explore Parishes Directory</span>
                <ExternalLink size={13} />
              </Button>
            </div>
          </Card>

          {/* Need Assistance Card */}
          <Card className="bg-app-page border border-border p-5 space-y-3.5">
            <div className="flex items-start space-x-3">
              <div className="p-2 bg-red-50 text-crimson rounded-button flex-shrink-0">
                <MessageSquare size={18} />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-text-primary text-sm">Need Assistance?</h3>
                <p className="text-xs text-text-muted leading-relaxed font-normal">
                  Chat with Caloy, our digital assistant, to ask questions about document requirements, fees, or parish office schedules.
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                const triggerBtn = document.querySelector('button[aria-label="Open Caloy AI Assistant"]') as HTMLButtonElement;
                if (triggerBtn) triggerBtn.click();
              }}
              className="w-full py-2 bg-white border border-crimson/30 rounded-button text-xs font-bold text-crimson hover:bg-red-50/50 transition-colors focus-ring shadow-xs"
            >
              Start Chat with Caloy
            </button>
          </Card>
        </div>
      </div>

      {/* Global Event Details Modal Overlay */}
      <EventDetailsModal
        event={selectedEvent}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onViewParish={handleViewParishFromEvent}
      />


    </div>
  );
};

export default HomePage;
