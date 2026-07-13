import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FileText, 
  Search, 
  Calendar, 
  Map, 
  ArrowRight, 
  Megaphone,
  Clock,
  ExternalLink,
  MessageSquare,
  Inbox,
  Bell,
  Building,
  CalendarDays,
  User as UserIcon
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  useParishes, 
  useRequests, 
  useAppointments, 
  useAnnouncements,
  useProfile,
  useEvents,
  useFeaturedEvents
} from '../../hooks/useService';
import type { Event } from '../../types';
import { getEventCountdownLabel } from '../../utils/date';
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

const getBadgeVariant = (status: any): 'pending' | 'under-review' | 'ready' | 'rejected' | 'neutral' | 'crimson' => {
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
    default:
      return 'under-review';
  }
};

export const HomePage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core Queries
  const parishesQuery = useParishes();
  const requestsQuery = useRequests();
  const appointmentsQuery = useAppointments();
  const announcementsQuery = useAnnouncements();
  const profileQuery = useProfile(user?.uid || '');
  const eventsQuery = useEvents();
  const featuredEventsQuery = useFeaturedEvents();

  // Modal State
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const loading = 
    parishesQuery.loading || 
    requestsQuery.loading || 
    appointmentsQuery.loading || 
    announcementsQuery.loading ||
    profileQuery.loading ||
    eventsQuery.loading ||
    featuredEventsQuery.loading;

  const error = 
    parishesQuery.error || 
    requestsQuery.error || 
    appointmentsQuery.error || 
    announcementsQuery.error ||
    profileQuery.error ||
    eventsQuery.error ||
    featuredEventsQuery.error;

  const refetchAll = () => {
    parishesQuery.refetch();
    requestsQuery.refetch();
    appointmentsQuery.refetch();
    announcementsQuery.refetch();
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
    { label: 'Request a Document', path: '/dashboard/request', icon: <FileText size={20} />, description: 'Submit requests for baptism, marriage, or other certificates.' },
    { label: 'Track a Request', path: '/dashboard/track', icon: <Search size={20} />, description: 'Check the real-time status and download approved documents.' },
    { label: 'Schedule an Appointment', path: '/dashboard/scheduler', icon: <Calendar size={20} />, description: 'Book canonical interviews, blessings, or weddings with a priest.' },
    { label: 'Parish Directory', path: '/dashboard/parishes', icon: <Map size={20} />, description: 'Locate vicariate parishes, contact offices, and view mass schedules.' },
    { label: 'Notifications', path: '/dashboard/notifications', icon: <Bell size={20} />, description: 'View your alerts, request status updates, and diocese announcements.' },
    { label: 'My Profile', path: '/dashboard/profile', icon: <UserIcon size={20} />, description: 'Manage your contact details, assigned parish, and email alerts.' },
  ];

  const getParishName = (parishId: string) => {
    return parishesQuery.data?.find(p => p.id === parishId)?.name || 'Local Parish';
  };

  if (error) {
    return (
      <div className="space-y-6">
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
      <div className="space-y-8 pb-10" aria-busy="true">
        <PageHeader 
          title="Home" 
          description="TESTIMONIUM parishioner overview portal."
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
          <div className="h-[480px] md:h-[380px] w-full rounded-card overflow-hidden bg-white border border-border/80 flex flex-col md:flex-row shadow-sm">
            <Skeleton className="w-full md:w-5/12 h-48 md:h-full animate-pulse" />
            <div className="flex-1 p-6 md:p-8 space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <Skeleton className="h-4 w-1/4 rounded animate-pulse" />
                <Skeleton className="h-8 w-3/4 rounded animate-pulse" />
                <Skeleton className="h-4 w-1/2 rounded animate-pulse" />
                <Skeleton className="h-16 w-full rounded animate-pulse" />
              </div>
              <Skeleton className="h-10 w-28 rounded-button animate-pulse" />
            </div>
          </div>
        </div>

        {/* Services Section Skeleton */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32 rounded animate-pulse" />
            <Skeleton className="h-4 w-48 rounded animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-44 w-full rounded-card" />
            ))}
          </div>
        </div>

        {/* Account Section Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-8">
          <div className="lg:col-span-8 space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24 rounded animate-pulse" />
              <Skeleton className="h-4 w-60 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {[1, 2].map(i => (
                <Skeleton key={i} className="h-44 w-full rounded-card" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const requests = requestsQuery.data || [];
  const appointments = appointmentsQuery.data || [];
  const announcements = announcementsQuery.data || [];
  const parishes = parishesQuery.data || [];
  const profile = profileQuery.data;
  const events = eventsQuery.data || [];
  const featuredEvents = featuredEventsQuery.data || [];

  // Filter next event assigned to user's local parish
  const nextParishEvent = profile?.parishId
    ? events.find(e => e.parishId === profile.parishId && e.status !== 'completed')
    : undefined;

  return (
    <div className="space-y-8 pb-10" aria-live="polite">
      <PageHeader 
        title="Home" 
        description="TESTIMONIUM parishioner overview portal."
        showBackToHome={false}
        onRefresh={refetchAll}
        breadcrumbs={['Home']}
      />

      {/* Welcome Card banner */}
      <Card className="bg-gradient-to-r from-crimson to-crimson-dark text-white border-none p-8 md:p-10 shadow-md">
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest">
            TESTIMONIUM Parishioner Web Portal
          </span>
          <h2 className="text-3xl md:text-4xl font-serif font-bold tracking-tight">
            Welcome back, {user?.displayName || 'Parishioner'}!
          </h2>
          <p className="text-sm md:text-base text-white/80 max-w-xl leading-relaxed">
            Manage document requests, schedule canonical interviews, and explore the directory of the parishes in the Vicariate of Canlaon.
          </p>
        </div>
      </Card>

      {/* Hero: Upcoming Vicariate Events Carousel */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-text-primary uppercase tracking-widest">
            Upcoming Vicariate Events
          </h2>
          <button 
            onClick={() => alert("Events Directory Page coming in Phase 7B!")}
            className="text-xs font-bold text-crimson hover:underline flex items-center space-x-1 focus-ring"
          >
            <span>See All Events</span>
            <ArrowRight size={14} />
          </button>
        </div>

        {featuredEvents.length === 0 ? (
          <EmptyState
            title="No featured events scheduled"
            description="There are currently no upcoming vicariate assemblies or parish seminars listed. You can browse individual parish schedules."
            icon={<CalendarDays size={40} className="text-text-muted/40" />}
            action={
              <Button size="sm" onClick={() => navigate('/dashboard/parishes')} className="bg-crimson hover:bg-crimson-dark">
                Browse Parish Directory
              </Button>
            }
          />
        ) : (
          <FeaturedEventsCarousel 
            events={featuredEvents} 
            onViewDetails={handleViewEventDetails} 
          />
        )}
      </div>

      {/* Personalized Section: Happening at Your Parish */}
      {nextParishEvent && (
        <div className="space-y-3">
          <h2 className="text-xs font-bold text-text-primary uppercase tracking-widest">
            Happening at Your Parish
          </h2>
          <Card className="bg-white border border-border/80 shadow-sm p-5 hover:shadow transition-shadow">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-border/40 pb-3 mb-4 space-y-2 sm:space-y-0">
              <div className="flex items-center space-x-2">
                <Building size={16} className="text-crimson" />
                <span className="text-xs font-semibold text-text-primary">{nextParishEvent.parishName}</span>
              </div>
              <div className="bg-crimson/10 text-crimson text-[10px] font-bold uppercase tracking-wider py-1 px-3 rounded-full">
                {getEventCountdownLabel(nextParishEvent.startDate)}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row items-start sm:space-x-5 space-y-3 sm:space-y-0">
              <div className="w-20 h-20 rounded overflow-hidden flex-shrink-0 bg-border">
                <img src={nextParishEvent.coverImage} alt={nextParishEvent.coverImageAlt} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 space-y-2">
                <h4 className="font-serif font-bold text-sm sm:text-base text-text-primary leading-snug">
                  {nextParishEvent.title}
                </h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                  <span>{new Date(nextParishEvent.startDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  <span>•</span>
                  <span>{nextParishEvent.startTime}</span>
                </div>
                <Button size="sm" onClick={() => handleViewEventDetails(nextParishEvent)} className="mt-1 bg-crimson hover:bg-crimson-dark">
                  View Details
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Services Section */}
      <section aria-label="Services Grid">
        <SectionHeader 
          title="Services" 
          description="Choose a service to begin."
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {quickActions.slice(0, 4).map(action => (
            <Card 
              key={action.path} 
              hoverable 
              className="cursor-pointer flex flex-col justify-between p-5 h-44 hover:shadow-card hover:scale-[1.01] transition-all duration-200"
              onClick={() => navigate(action.path)}
            >
              <div className="p-3 bg-red-50 text-crimson rounded-button w-fit">
                {action.icon}
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-text-primary text-sm flex items-center group">
                  <span>{action.label}</span>
                  <ArrowRight size={14} className="ml-1.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                </h3>
                <p className="text-xs text-text-muted">{action.description}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Account Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-12">
        <section aria-label="Account Settings" className="lg:col-span-8">
          <SectionHeader 
            title="Account" 
            description="Manage your personal portal information."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {quickActions.slice(4).map(action => (
              <Card 
                key={action.path} 
                hoverable 
                className="bg-gray-50/40 cursor-pointer flex flex-col justify-between p-5 h-44 hover:shadow-card hover:scale-[1.01] transition-all duration-200"
                onClick={() => navigate(action.path)}
              >
                <div className="p-3 bg-gray-100 text-text-muted rounded-button w-fit">
                  {action.icon}
                </div>
                <div className="space-y-1">
                  <h3 className="font-serif font-bold text-text-primary text-sm flex items-center group">
                    <span>{action.label}</span>
                    <ArrowRight size={14} className="ml-1.5 opacity-60 group-hover:translate-x-0.5 transition-transform" />
                  </h3>
                  <p className="text-xs text-text-muted">{action.description}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </div>

      {/* Core Grid: Left Column for history & announcements, Right for Map Directory */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Side: Recent updates & announcements (Col-span 8) */}
        <div className="lg:col-span-8 space-y-8">
          {/* Recent Requests */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center space-x-2 text-base">
                <Clock size={18} className="text-crimson" />
                <span>Recent Sacramental Requests</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              {requests.length === 0 ? (
                <EmptyState 
                  title="No document requests yet"
                  description="Your submitted certificate requests will appear here once you make a request."
                  icon={<Inbox size={32} className="text-text-muted/40" />}
                  action={
                    <Button size="sm" onClick={() => navigate('/dashboard/request')} className="bg-crimson hover:bg-crimson-dark">
                      Request a Document
                    </Button>
                  }
                />
              ) : (
                requests.slice(0, 3).map(req => (
                  <div 
                    key={req.id} 
                    onClick={() => navigate('/dashboard/track')} 
                    className="p-3.5 bg-app-page hover:bg-border/30 rounded-button border border-border/60 cursor-pointer transition-colors flex justify-between items-center"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-semibold text-text-primary">
                          {req.trackingNumber}
                        </span>
                        <span className="text-[10px] text-text-muted">•</span>
                        <span className="text-[10px] font-semibold uppercase text-text-muted capitalize">
                          {req.documentType} Certificate
                        </span>
                      </div>
                      <p className="text-xs text-text-muted truncate max-w-[300px]">
                        Parish: {getParishName(req.parishId)}
                      </p>
                    </div>
                    <Badge variant={getBadgeVariant(req.status)}>
                      {req.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Upcoming Appointments */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center space-x-2 text-base">
                <Calendar size={18} className="text-crimson" />
                <span>Upcoming Appointments</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5">
              {appointments.length === 0 ? (
                <EmptyState 
                  title="No appointments scheduled"
                  description="Book a blessing, counseling session, or sacramental appointment with your parish priest."
                  icon={<Calendar size={32} className="text-text-muted/40" />}
                  action={
                    <Button size="sm" onClick={() => navigate('/dashboard/scheduler')} className="bg-crimson hover:bg-crimson-dark">
                      Schedule Appointment
                    </Button>
                  }
                />
              ) : (
                appointments.slice(0, 3).map(appt => (
                  <div 
                    key={appt.id} 
                    className="p-3.5 bg-app-page rounded-button border border-border/60 flex justify-between items-center"
                  >
                    <div className="space-y-1 min-w-0">
                      <h4 className="text-xs font-bold text-text-primary">
                        {appt.serviceName}
                      </h4>
                      <p className="text-xs text-text-muted">
                        {getParishName(appt.parishId)}
                      </p>
                      <p className="text-[10px] text-text-muted">
                        {appt.date} at {appt.timeSlot}
                      </p>
                    </div>
                    <Badge variant="ready">
                      {appt.status}
                    </Badge>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card>
            <CardHeader className="border-b border-border pb-4">
              <CardTitle className="flex items-center space-x-2 text-base">
                <Megaphone size={18} className="text-crimson" />
                <span>Diocese Announcements</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {announcements.length === 0 ? (
                <EmptyState 
                  title="No announcements available"
                  description="Check back later for diocese updates, parish events, and canonical announcements."
                  icon={<Bell size={32} className="text-text-muted/40" />}
                />
              ) : (
                announcements.slice(0, 3).map(ann => (
                  <div key={ann.id} className="pb-4 border-b border-border last:border-none last:pb-0 space-y-1">
                    <span className="text-[10px] text-text-muted font-bold">
                      {new Date(ann.date).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}
                    </span>
                    <h4 className="font-semibold text-text-primary text-sm mt-0.5">{ann.title}</h4>
                    <p className="text-xs text-text-muted mt-1 leading-relaxed">{ann.content}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Featured Vicariate Map Preview & Need Help (Col-span 4) */}
        <div className="lg:col-span-4 space-y-8">
          {/* Featured Vicariate Map */}
          <Card className="overflow-hidden p-0 border border-border">
            <div className="p-4 border-b border-border bg-white flex-shrink-0">
              <h3 className="font-serif font-bold text-text-primary text-sm flex items-center space-x-1.5">
                <Map size={16} className="text-crimson" />
                <span>Vicariate Map Preview</span>
              </h3>
            </div>
            
            {/* Embedded Mini Leaflet map */}
            <div className="h-60 w-full relative bg-gray-100">
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
            
            <div className="p-4 bg-white">
              <Button 
                size="sm" 
                onClick={() => navigate('/dashboard/parishes')} 
                className="w-full flex items-center justify-center space-x-1.5"
              >
                <span>Explore All Parishes</span>
                <ExternalLink size={14} />
              </Button>
            </div>
          </Card>

          {/* Need Help Banner (Trigger assistant) */}
          <Card className="bg-app-page border border-border/80 p-5 space-y-4">
            <div className="flex items-start space-x-3.5">
              <div className="p-2.5 bg-red-50 text-crimson rounded-button">
                <MessageSquare size={20} />
              </div>
              <div className="space-y-1">
                <h3 className="font-serif font-bold text-text-primary text-sm">Need Assistance?</h3>
                <p className="text-xs text-text-muted leading-relaxed">
                  Chat with Caloy, our digital assistant, to ask questions about document fees, required files, or mass times.
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                const triggerBtn = document.querySelector('button[aria-label="Open Caloy AI Assistant"]') as HTMLButtonElement;
                if (triggerBtn) triggerBtn.click();
              }}
              className="w-full py-2 border border-crimson/20 rounded-button text-xs font-semibold text-crimson hover:bg-crimson/5 transition-colors focus-ring"
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
