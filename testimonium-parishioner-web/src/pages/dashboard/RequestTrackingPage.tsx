import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, FileText, Clock, ArrowLeft, Calendar, Building, User, Loader2, ArrowRight } from 'lucide-react';
import services from '../../providers/factory';
import { useRequests } from '../../hooks/useService';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
import type { SacramentalRequest, RequestStatus, Appointment } from '../../types';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SearchInput } from '../../components/ui/SearchInput';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import PaymentInstructionsCard from '../../features/payments/components/PaymentInstructionsCard';
import ReceiptUploadCard from '../../features/payments/components/ReceiptUploadCard';
import { ErrorState } from '../../components/ui/ErrorState';
import ScheduleRescheduleHistory from '../../features/scheduler/components/ScheduleRescheduleHistory';
import { UPLOAD_POLICIES, validateUploadFile } from '../../utils/uploadPolicy';

const getBadgeVariant = (status: any): 'pending' | 'under-review' | 'ready' | 'rejected' | 'neutral' | 'crimson' | 'correction' => {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'under-review':
    case 'payment-under-review':
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

const formatStatusDisplay = (status: string) => {
  if (status === 'payment-under-review') return 'Awaiting Payment Review';
  if (status === 'payment-needs-correction') return 'Payment Needs Correction';
  if (status === 'needs-correction' || status === 'needs_correction') return 'Needs Correction';
  if (status === 'payment-pending') return 'Payment Required';
  return status;
};

const formatScheduleStatusDisplay = (status: string, priestStatus?: string | null) => {
  const norm = (status || '').toUpperCase();
  if (norm === 'CONFIRMED') return 'Confirmed';
  if (norm === 'COMPLETED') return 'Completed';
  if (norm === 'CANCELLED') return 'Cancelled';
  if (norm === 'REJECTED') return 'Declined';
  if (norm === 'PROPOSED_RESCHEDULE' || norm === 'PROPOSED' || norm === 'WAITING_PARISHIONER_RESPONSE') {
    return 'Reschedule Proposed';
  }
  if (norm === 'REQUESTED' || norm === 'BOOKED' || norm === 'PENDING') {
    if (priestStatus === 'PENDING') {
      return 'Pending Priest Acceptance';
    }
    return 'Requested / Under Review';
  }
  return status;
};

const getScheduleBadgeVariant = (status: string): 'pending' | 'under-review' | 'ready' | 'rejected' | 'neutral' | 'crimson' | 'correction' => {
  const norm = (status || '').toLowerCase();
  switch (norm) {
    case 'confirmed':
    case 'completed':
      return 'ready';
    case 'cancelled':
    case 'rejected':
      return 'rejected';
    case 'proposed':
    case 'proposed_reschedule':
    case 'waiting_parishioner_response':
      return 'correction';
    case 'booked':
    case 'pending':
    case 'requested':
    default:
      return 'under-review';
  }
};

const EMPTY_REQUESTS: SacramentalRequest[] = [];

export const RequestTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { requireCompleteProfile } = useProfileRequirement();

  const requestsQuery = useRequests();
  const requests = requestsQuery.data ?? EMPTY_REQUESTS;
  const { loading, error, refetch } = requestsQuery;

  const [searchQuery, setSearchQuery] = useState('');
  const [searchError, setSearchError] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);

  // Responsive state to apply tab semantics only on mobile (<1024px)
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 1024;
    }
    return false;
  });

  useEffect(() => {
    const mql = window.matchMedia('(max-width: 1023px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  // Stable source of truth for selection is the ID, not a stale copied object
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchedRequest, setSearchedRequest] = useState<SacramentalRequest | null>(null);

  // Derive selectedRequest directly from latest polling/refetched requests array
  const selectedRequest = useMemo(() => {
    if (!selectedRequestId) return null;
    const found = requests.find(r => String(r.id) === String(selectedRequestId));
    if (found) return found;
    if (searchedRequest && String(searchedRequest.id) === String(selectedRequestId)) {
      return searchedRequest;
    }
    return null;
  }, [requests, selectedRequestId, searchedRequest]);

  const authoritativePaymentAmount = useMemo(() => {
    if (!selectedRequest) return null;
    const candidate = selectedRequest.fee ?? selectedRequest.paymentTransactions?.[0]?.amount;
    const amount = typeof candidate === 'string' ? Number(candidate) : candidate;
    return typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 ? amount : null;
  }, [selectedRequest]);

  // Local presentation state for responsive tabs on mobile (<1024px)
  const [mobileView, setMobileView] = useState<'requests' | 'details'>('requests');

  // Mode state: 'documents' or 'schedules'
  const [activeMode, setActiveMode] = useState<'documents' | 'schedules'>('documents');

  // Schedules state
  const [schedules, setSchedules] = useState<Appointment[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [selectedScheduleId, setSelectedScheduleId] = useState<string | null>(null);
  const [searchedSchedule, setSearchedSchedule] = useState<Appointment | null>(null);
  const [scheduleSearchQuery, setScheduleSearchQuery] = useState('');
  const [scheduleSearching, setScheduleSearching] = useState(false);
  const [scheduleSearchError, setScheduleSearchError] = useState<string | null>(null);
  const [mobileScheduleView, setMobileScheduleView] = useState<'schedules' | 'details'>('schedules');

  const loadSchedules = useCallback(async () => {
    setLoadingSchedules(true);
    try {
      const appts = await services.scheduler.getAppointments();
      setSchedules(appts || []);
      if (appts && appts.length > 0 && !selectedScheduleId) {
        setSelectedScheduleId(String(appts[0].id));
      }
    } catch (err) {
      console.error('Failed to load schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  }, [selectedScheduleId]);

  useEffect(() => {
    if (activeMode === 'schedules') {
      void loadSchedules();
    }
  }, [activeMode, loadSchedules]);

  const selectedSchedule = useMemo(() => {
    if (searchedSchedule && String(searchedSchedule.id) === String(selectedScheduleId)) {
      return searchedSchedule;
    }
    const found = schedules.find(s => String(s.id) === String(selectedScheduleId));
    if (found) return found;
    return searchedSchedule || (schedules.length > 0 ? schedules[0] : null);
  }, [schedules, selectedScheduleId, searchedSchedule]);

  const handleScheduleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = scheduleSearchQuery.trim();
    if (!query) return;

    setScheduleSearching(true);
    setScheduleSearchError(null);

    try {
      const match = await services.scheduler.getAppointmentByTracking(query);
      if (match) {
        setSearchedSchedule(match);
        setSelectedScheduleId(String(match.id));
        setMobileScheduleView('details');
      } else {
        setSearchedSchedule(null);
        setScheduleSearchError("We couldn't find a schedule request with that reference.");
      }
    } catch (err: any) {
      const status = err?.status ?? err?.statusCode;
      if (status === 404 || status === 403 || err?.code === 'SCHEDULE_NOT_FOUND') {
        setScheduleSearchError("We couldn't find a schedule request with that reference.");
      } else {
        setScheduleSearchError("Unable to retrieve schedule status right now. Please try again.");
      }
      setSearchedSchedule(null);
    } finally {
      setScheduleSearching(false);
    }
  };

  const handleSelectSchedule = (sched: Appointment) => {
    setSelectedScheduleId(String(sched.id));
    setSearchedSchedule(null);
    setScheduleSearchQuery('');
    setScheduleSearchError(null);
    setMobileScheduleView('details');
  };

  const getScheduleMilestones = (schedule: Appointment) => {
    const isPriestAssigned = Boolean(schedule.assignedPriestId || schedule.assignedPriestName);
    const isPriestAccepted = isPriestAssigned && schedule.priestResponseStatus === 'ACCEPTED';
    const isConfirmed = schedule.status === 'confirmed';
    const isCompleted = (schedule.status as string) === 'completed';

    return [
      {
        key: 'submitted',
        label: 'Request Submitted',
        done: true,
        desc: 'Your schedule request was officially received by the parish.',
      },
      {
        key: 'priest-assigned',
        label: 'Priest Assigned',
        done: isPriestAssigned,
        desc: schedule.assignedPriestName
          ? `Assigned to Rev. Fr. ${schedule.assignedPriestName}.`
          : 'Parish office is assigning an available priest.',
      },
      {
        key: 'priest-accepted',
        label: 'Priest Acceptance',
        done: isPriestAccepted,
        desc: isPriestAccepted
          ? 'Assigned priest has accepted the schedule.'
          : isPriestAssigned
          ? 'Awaiting acceptance from assigned priest.'
          : 'Pending priest assignment.',
      },
      {
        key: 'confirmed',
        label: 'Appointment Confirmed',
        done: isConfirmed || isCompleted,
        desc: isConfirmed || isCompleted
          ? 'Appointment is officially confirmed on parish calendar.'
          : 'Final confirmation pending priest acceptance.',
      },
      {
        key: 'completed',
        label: 'Appointment Concluded',
        done: isCompleted,
        desc: isCompleted
          ? 'Rite or blessing has been completed.'
          : 'Awaiting scheduled date and occurrence.',
      },
    ];
  };


  // Correction Resubmission State
  const [correctionReqsList, setCorrectionReqsList] = useState<Array<{ id: string; label: string; required: boolean; description?: string }>>([]);
  const [loadingCorrectionReqs, setLoadingCorrectionReqs] = useState(false);
  const [uploadedFilesByCorrectionReq, setUploadedFilesByCorrectionReq] = useState<Record<string, File>>({});
  const [submittingCorrections, setSubmittingCorrections] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionInputErrors, setCorrectionInputErrors] = useState<Record<string, string>>({});
  const [uploadedCorrectionReqIds, setUploadedCorrectionReqIds] = useState<Record<string, boolean>>({});
  const correctionSubmitInFlightRef = useRef(false);
  const correctionSessionKey = selectedRequest
    ? `${selectedRequest.id}:${selectedRequest.status}:${(selectedRequest.correctionRequirementIds || []).join(',')}`
    : null;

  const hasSystemSatisfiedCorrection = Boolean(
    selectedRequest?.correctionRequirementIds?.includes('valid_id')
  );
  const handleCorrectionFileSelect = (reqId: string, file: File) => {
    const policy = reqId.startsWith('registrant_id_')
      ? UPLOAD_POLICIES.REGISTRANT_ID_IMAGE
      : reqId === 'authorization_letter'
        ? UPLOAD_POLICIES.AUTHORIZATION_LETTER
        : UPLOAD_POLICIES.CORRECTION_DOCUMENT;
    const result = validateUploadFile(file, policy);
    if (!result.valid) {
      setCorrectionInputErrors(prev => ({ ...prev, [reqId]: result.error || 'Unsupported file format. Accepted formats: PDF, JPG, PNG, or WebP — up to 5 MB.' }));
      return;
    }
    setCorrectionInputErrors(prev => {
      const copy = { ...prev };
      delete copy[reqId];
      return copy;
    });
    setUploadedFilesByCorrectionReq(prev => ({ ...prev, [reqId]: file }));
  };

  useEffect(() => {
    if (selectedRequest && (selectedRequest.status === 'needs-correction' || selectedRequest.status === 'needs_correction')) {
      setLoadingCorrectionReqs(true);
      setCorrectionError(null);
      setCorrectionSuccess(false);
      setUploadedFilesByCorrectionReq({});
      setUploadedCorrectionReqIds({});
      setCorrectionInputErrors({});
      services.request.getDocumentRequirements(selectedRequest.documentType, selectedRequest.parishId, selectedRequest.relationship || 'Self')
        .then(res => {
          const reqs = [...(res?.requiredDocuments || []), ...(res?.relationshipEvidence || [])];
          const selectedReqIds = (selectedRequest.correctionRequirementIds || []).filter(
            id => id !== 'valid_id'
          );
          const filtered = reqs.filter((r: any) => selectedReqIds.includes(r.id));
          setCorrectionReqsList(filtered);
        })
        .catch(err => {
          console.error("Failed to load correction requirements:", err);
          setCorrectionError("Failed to load document requirements. Please refresh.");
        })
        .finally(() => {
          setLoadingCorrectionReqs(false);
        });
    } else {
      setCorrectionReqsList([]);
    }
    // Refreshes of the same authoritative request must not erase successful or pending uploads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [correctionSessionKey]);

  // Parse query parameter for specific request ID
  const queryParams = new URLSearchParams(window.location.search);
  const paramRequestId = queryParams.get('requestId');

  // Sync selected request ID on initial load or query param change
  useEffect(() => {
    if (requests.length > 0) {
      if (paramRequestId) {
        const found = requests.find(r => String(r.id) === paramRequestId);
        if (found) {
          setSelectedRequestId(String(found.id));
          setMobileView('details');
          return;
        } else {
          // Gracefully redirect to Notification Center if the resource no longer exists
          navigate('/dashboard/notifications');
          return;
        }
      }
      if (!selectedRequestId) {
        setSelectedRequestId(String(requests[0].id));
      }
    }
  }, [requests, selectedRequestId, paramRequestId, navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchError(false);
    setSearchCompleted(true);
    try {
      const match = await services.request.getRequestByTrackingNumber(searchQuery.trim());
      if (match) {
        const matchId = String(match.id);
        const inList = requests.find(r => String(r.id) === matchId);
        if (inList) {
          setSelectedRequestId(matchId);
          setSearchedRequest(null);
        } else {
          setSearchedRequest(match);
          setSelectedRequestId(matchId);
        }
        setMobileView('details');
      } else {
        setSelectedRequestId(null);
        setSearchedRequest(null);
        setSearchError(true);
      }
    } catch (err) {
      console.error(err);
      setSelectedRequestId(null);
      setSearchedRequest(null);
      setSearchError(true);
    }
  };

  const getExpectedProcessMilestones = (status: RequestStatus) => {
    return [
      { key: 'created', label: 'Request Submitted', done: true, desc: 'Your request was officially received by the system.' },
      {
        key: 'received',
        label: 'Parish Review & Validation',
        done: status !== 'pending',
        desc: status === 'pending' ? 'Awaiting initial parish review.' : 'Parish office has received and is reviewing registry records.'
      },
      {
        key: 'validated',
        label: 'Canonical Record Search',
        done: status === 'ready' || status === 'completed',
        desc: status === 'ready' || status === 'completed' ? 'Registry verified and document signed.' : 'Locating archival book, volume, and folio entries.'
      },
      {
        key: 'pickup',
        label: 'Ready for Collection',
        done: status === 'ready' || status === 'completed',
        desc: status === 'ready' || status === 'completed' ? 'Document is prepared and ready for pickup at parish office.' : 'Pending final preparation and seal.'
      }
    ];
  };

  const handleSelectRequest = (req: SacramentalRequest) => {
    setSelectedRequestId(String(req.id));
    setSearchedRequest(null);
    setSearchQuery('');
    setSearchError(false);
    setSearchCompleted(false);
    setMobileView('details');
  };

  const handleRefresh = () => {
    setSearchQuery('');
    setSearchError(false);
    setSearchCompleted(false);
    setSelectedRequestId(null);
    setSearchedRequest(null);
    refetch();
  };

  const handleOptimisticPaymentUpload = (updatedRequest?: SacramentalRequest) => {
    if (updatedRequest) {
      setSearchedRequest(updatedRequest);
      setSelectedRequestId(String(updatedRequest.id));
    }
    refetch();
  };

  if (error) {
    return (
      <div className="space-y-6 text-left">
        <PageHeader
          title="Track Request Status"
          description="Search via your reference number or view existing requests below."
          onRefresh={handleRefresh}
          breadcrumbs={['Home', 'Request Tracking']}
        />
        <ErrorState
          title="Failed to load request logs"
          description="We had trouble retrieving your sacramental requests history. Please check your connection and try again."
          onRetry={handleRefresh}
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 text-left" aria-busy="true">
        <PageHeader
          title="Track Request Status"
          description="Search via your reference number or view existing requests below."
          onRefresh={handleRefresh}
          isRefreshing={true}
          breadcrumbs={['Home', 'Request Tracking']}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column Skeleton */}
          <div className="lg:col-span-5 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <Skeleton className="h-5 w-40 rounded" />
                  <Skeleton className="h-10 w-full rounded-button" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48 rounded" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-16 w-full rounded-button" />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Right Column Skeleton */}
          <div className="lg:col-span-7">
            <Card className="p-6 space-y-6">
              <Skeleton className="h-8 w-48 rounded" />
              <Skeleton className="h-24 w-full rounded-card" />
              <div className="space-y-4 pt-4">
                <Skeleton className="h-5 w-40 rounded" />
                {[1, 2, 3, 4].map(i => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="w-5 h-5 rounded-full" />
                    <Skeleton className="h-4 flex-1 rounded" />
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  const handlePageRefresh = () => {
    if (activeMode === 'schedules') {
      setScheduleSearchQuery('');
      setScheduleSearchError(null);
      void loadSchedules();
    } else {
      handleRefresh();
    }
  };

  return (
    <div className="space-y-6 text-left" aria-live="polite">
      <PageHeader
        title="Track Request Status"
        description="Search via your reference number or view existing requests below."
        onRefresh={handlePageRefresh}
        breadcrumbs={['Home', 'Request Tracking']}
      />

      {/* Mode Switcher Tabs */}
      <div
        className="flex bg-app-page p-1 rounded-card border border-border max-w-md w-full"
        role="tablist"
        aria-label="Tracking category"
      >
        <button
          id="tracking-mode-tab-documents"
          type="button"
          role="tab"
          aria-selected={activeMode === 'documents'}
          aria-controls="tracking-mode-panel-documents"
          onClick={() => setActiveMode('documents')}
          className={`flex-1 py-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-2 focus-ring ${
            activeMode === 'documents'
              ? 'bg-white text-crimson shadow-xs border border-border/50'
              : 'text-gray-600 hover:text-text-primary'
          }`}
        >
          <FileText size={15} />
          <span>Document Request</span>
        </button>
        <button
          id="tracking-mode-tab-schedules"
          type="button"
          role="tab"
          aria-selected={activeMode === 'schedules'}
          aria-controls="tracking-mode-panel-schedules"
          onClick={() => setActiveMode('schedules')}
          className={`flex-1 py-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-2 focus-ring ${
            activeMode === 'schedules'
              ? 'bg-white text-crimson shadow-xs border border-border/50'
              : 'text-gray-600 hover:text-text-primary'
          }`}
        >
          <Calendar size={15} />
          <span>Schedule Request</span>
        </button>
      </div>

      {activeMode === 'documents' ? (
        <div id="tracking-mode-panel-documents" role="tabpanel" aria-labelledby="tracking-mode-tab-documents">
          {requests.length === 0 ? (
        <EmptyState
          title="No document requests yet"
          description="You have not submitted any certificate requests. Submit a document request using our wizard to start tracking."
          icon={<FileText size={48} className="text-text-muted/40" />}
          action={
            <Button
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
        <>
          {/* Mobile Tab Switcher (<1024px) with Full ARIA Semantics */}
          <div
            className="flex lg:hidden bg-app-page p-1 rounded-card border border-border"
            role="tablist"
            aria-label="Request tracking views"
          >
            <button
              id="tracking-tab-requests"
              type="button"
              onClick={() => setMobileView('requests')}
              role="tab"
              aria-selected={mobileView === 'requests'}
              aria-controls="tracking-panel-requests"
              className={`flex-1 py-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-1.5 focus-ring ${
                mobileView === 'requests'
                  ? 'bg-white text-crimson shadow-xs border border-border/50'
                  : 'text-gray-600 hover:text-text-primary'
              }`}
            >
              <FileText size={14} />
              <span>My Requests ({requests.length})</span>
            </button>
            <button
              id="tracking-tab-details"
              type="button"
              onClick={() => setMobileView('details')}
              disabled={!selectedRequest}
              role="tab"
              aria-selected={mobileView === 'details'}
              aria-controls="tracking-panel-details"
              className={`flex-1 py-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-1.5 focus-ring disabled:opacity-40 ${
                mobileView === 'details'
                  ? 'bg-white text-crimson shadow-xs border border-border/50'
                  : 'text-gray-600 hover:text-text-primary'
              }`}
            >
              <Clock size={14} />
              <span>Request Details</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Side: Search & Submissions List (Col-span 5 on desktop) */}
            <section
              id={isMobile ? "tracking-panel-requests" : undefined}
              role={isMobile ? "tabpanel" : undefined}
              aria-labelledby={isMobile ? "tracking-tab-requests" : undefined}
              aria-label={!isMobile ? "My Submitted Requests" : undefined}
              className={`flex flex-col gap-6 ${mobileView === 'details' ? 'hidden lg:flex lg:col-span-5' : 'flex lg:col-span-5'}`}
            >
              {/* Search Form */}
              <div className="bg-white rounded-card border border-border p-5 shadow-xs transition-all duration-fast">
                <form onSubmit={handleSearch} className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="search-tracking-input" className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                      Search Tracking Number
                    </label>
                    <p className="text-[11px] text-gray-600">Enter the TX reference code from your submission.</p>
                  </div>
                  <div className="flex gap-2">
                    <SearchInput
                      id="search-tracking-input"
                      placeholder="e.g. TX-2026-88401"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      aria-label="Tracking reference number"
                    />
                    <Button type="submit" size="sm" className="font-semibold">
                      Search
                    </Button>
                  </div>
                </form>
              </div>

              {/* Submissions List */}
              <div className="bg-white rounded-card border border-border p-5 shadow-xs">
                <div className="mb-3.5 border-b border-border pb-2.5">
                  <h2 className="text-sm font-bold text-text-primary">My Submitted Requests</h2>
                </div>
                <div className="space-y-2.5 pt-0">
                  {requests.map(req => {
                    const isSelected = selectedRequest?.id === req.id;
                    return (
                      <button
                        key={req.id}
                        type="button"
                        onClick={() => handleSelectRequest(req)}
                        className={`w-full p-3.5 rounded-button border text-left transition-all focus-ring relative group cursor-pointer ${
                          isSelected
                            ? 'border-crimson bg-red-50/20 shadow-xs'
                            : 'border-border/80 hover:bg-app-page hover:border-gray-300'
                        }`}
                        aria-current={isSelected ? 'true' : undefined}
                      >
                        <div className="flex justify-between items-center gap-2 mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <FileText size={14} className={isSelected ? 'text-crimson flex-shrink-0' : 'text-text-muted flex-shrink-0'} />
                            <span className="text-xs font-mono font-bold text-text-primary truncate">
                              {req.trackingNumber}
                            </span>
                          </div>
                          <Badge variant={getBadgeVariant(req.status)}>
                            {formatStatusDisplay(req.status)}
                          </Badge>
                        </div>
                        <div className="flex justify-between items-center text-[11px] text-gray-600">
                          <span className="capitalize font-medium">{req.documentType} Certificate</span>
                          <span>{new Date(req.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* Right Side: Details, Payments & Timeline (Col-span 7 on desktop) */}
            <section
              id={isMobile ? "tracking-panel-details" : undefined}
              role={isMobile ? "tabpanel" : undefined}
              aria-labelledby={isMobile ? "tracking-tab-details" : undefined}
              aria-label={!isMobile ? "Request Details" : undefined}
              className={`flex flex-col gap-6 ${mobileView === 'requests' ? 'hidden lg:flex lg:col-span-7' : 'flex lg:col-span-7'}`}
            >
              {/* Back button on mobile to return to list */}
              {isMobile && (
                <div>
                  <button
                    type="button"
                    onClick={() => setMobileView('requests')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-crimson hover:underline py-1 focus-ring rounded cursor-pointer"
                  >
                    <ArrowLeft size={14} />
                    <span>Back to My Requests List</span>
                  </button>
                </div>
              )}


              {selectedRequest ? (
                selectedRequest.status === 'payment-pending' ? authoritativePaymentAmount === null ? (
                  <div className="p-5 bg-amber-50 border border-amber-200 rounded-card text-sm text-amber-900">
                    Payment instructions are unavailable because this request has no valid parish fee. Please contact the parish office.
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 animate-in fade-in duration-200">
                    {/* Payment Required Banner Card */}
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-card flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs text-left">
                      <div className="space-y-2 max-w-xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full tracking-wider border border-amber-200/50">
                            Payment Required
                          </span>
                          <span className="font-mono text-xs font-bold text-text-primary">
                            {selectedRequest.trackingNumber}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-text-primary">
                          Sacramental certificate fee pending settlement
                        </h3>
                        <p className="text-xs text-text-muted font-normal leading-relaxed">
                          Your request for a <span className="font-semibold text-text-primary capitalize">{selectedRequest.documentType} Certificate</span> has been reviewed and requires a processing fee. Please follow the instructions to upload payment receipt proof.
                        </p>
                      </div>

                      <div className="text-left bg-white p-3.5 rounded-xl border border-amber-200/80 shrink-0 flex flex-col justify-center shadow-xs">
                        <span className="text-[10px] text-text-muted uppercase font-bold tracking-wider">Amount Due</span>
                        <span className="text-xl font-extrabold text-crimson mt-0.5">
                          {`\u20B1${authoritativePaymentAmount.toFixed(2)}`}
                        </span>
                      </div>
                    </div>

                    {/* Side-by-side Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <PaymentInstructionsCard
                        requestId={selectedRequest.id}
                        amount={authoritativePaymentAmount}
                      />
                      <ReceiptUploadCard
                        requestId={selectedRequest.id}
                        existingTransaction={selectedRequest.paymentTransactions?.[0]}
                        onSuccess={(updatedRequest) => handleOptimisticPaymentUpload(updatedRequest)}
                      />
                    </div>
                  </div>
                ) : selectedRequest.status === 'payment-needs-correction' ? (
                  <div className="flex flex-col gap-6 animate-in fade-in duration-200 text-left">
                    {/* Correction Required Banner Card */}
                    <div className="p-5 bg-amber-50 border border-amber-200 rounded-card space-y-4 text-left shadow-xs">
                      <div className="flex items-start space-x-2.5">
                        <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-amber-900">Payment Correction Required</h4>
                          <p className="text-xs text-amber-800 mt-1 leading-relaxed font-normal">
                            The parish secretary has requested a correction for your uploaded payment receipt. Please review the note below and upload a replacement receipt.
                          </p>

                          {selectedRequest.paymentCorrectionNote && (
                            <div className="mt-3 p-3 bg-white border border-amber-200 rounded-xl">
                              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block mb-1">Secretary Note</span>
                              <p className="text-xs text-gray-800 italic">"{selectedRequest.paymentCorrectionNote}"</p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Previous Receipt Reference */}
                      {selectedRequest.paymentTransactions?.[0]?.receipts?.[0] && (
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white border border-border rounded-xl text-xs gap-3">
                          <div className="flex flex-col min-w-0">
                            <span className="truncate max-w-[280px] font-semibold text-gray-800">
                              Previous Receipt: {selectedRequest.paymentTransactions[0].receipts[0].fileName}
                            </span>
                            <span className="text-[10px] text-gray-500 mt-0.5">
                              Uploaded: {new Date(selectedRequest.paymentTransactions[0].receipts[0].uploadedAt).toLocaleDateString()}
                            </span>
                          </div>
                          <a
                            href={`https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/${selectedRequest.paymentTransactions[0].receipts[0].r2ObjectKey}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-1.5 bg-crimson text-white hover:bg-crimson-dark text-xs font-bold rounded-button transition-all text-center focus-ring"
                          >
                            View Receipt
                          </a>
                        </div>
                      )}
                    </div>

                    {/* Replacement Upload */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <PaymentInstructionsCard requestId={selectedRequest.id} />
                      <ReceiptUploadCard
                        requestId={selectedRequest.id}
                        existingTransaction={undefined}
                        onSuccess={(updatedRequest) => handleOptimisticPaymentUpload(updatedRequest)}
                      />
                    </div>
                  </div>
                ) : (
                  <Card className="space-y-6">
                    <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center space-y-2 sm:space-y-0 pb-4 border-b border-border">
                      <div className="space-y-1">
                        <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">Active Tracking Details</span>
                        <CardTitle className="font-mono text-xl">{selectedRequest.trackingNumber}</CardTitle>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-text-muted capitalize">{selectedRequest.documentType} Document</span>
                        <Badge variant={getBadgeVariant(selectedRequest.status)}>
                          {formatStatusDisplay(selectedRequest.status)}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-6 pt-0">
                      {/* Request Details Metadata */}
                      <div className="grid grid-cols-2 gap-4 text-xs bg-app-page p-4 rounded-card border border-border/60">
                        <div>
                          <span className="text-gray-600 block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Applicant</span>
                          <span className="font-bold text-text-primary">{selectedRequest.applicantName}</span>
                        </div>
                        <div>
                          <span className="text-gray-600 block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Relationship</span>
                          <span className="font-bold text-text-primary">{selectedRequest.relationship}</span>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-border/40">
                          <span className="text-gray-600 block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Purpose</span>
                          <p className="text-text-primary leading-relaxed">{selectedRequest.purpose}</p>
                        </div>

                        {/* Payment Details if available */}
                        {selectedRequest.paymentStatus && (
                          <div className="col-span-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-3 text-xs text-left">
                            <div>
                              <span className="text-gray-600 block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Payment Status</span>
                              <span className="font-bold text-text-primary capitalize">{selectedRequest.paymentStatus.toLowerCase()}</span>
                            </div>
                            {selectedRequest.paymentTransactions && selectedRequest.paymentTransactions.length > 0 && (
                              <>
                                <div>
                                  <span className="text-gray-600 block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Reference No</span>
                                  <span className="font-mono font-bold text-text-primary">{selectedRequest.paymentTransactions[0].referenceNumber || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-gray-600 block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Amount Detected</span>
                                  <span className="font-bold text-text-primary">
                                    {selectedRequest.paymentTransactions[0].amount ? `\u20B1${selectedRequest.paymentTransactions[0].amount}` : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-gray-600 block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Verification</span>
                                  <span className="font-bold text-text-primary">
                                    {selectedRequest.paymentTransactions[0].verifiedAt
                                      ? `Verified on ${new Date(selectedRequest.paymentTransactions[0].verifiedAt).toLocaleDateString()}`
                                      : 'Pending Verification'}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Correction Resubmission Section */}
                      {(selectedRequest.status === 'needs-correction' || selectedRequest.status === 'needs_correction') && (
                        <div className="p-5 bg-amber-50 border border-amber-200 rounded-card space-y-4 text-left">
                          <div className="flex items-start space-x-2.5">
                            <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <h4 className="text-sm font-bold text-amber-900">Document Correction Required</h4>
                              <p className="text-xs text-amber-800 mt-1 leading-relaxed font-normal">
                                The parish secretary has requested corrections for the requirement(s) listed below. Please upload replacement files.
                              </p>
                              {selectedRequest.correctionNote && (
                                <div className="mt-3 p-3 bg-white border border-amber-200 rounded-xl">
                                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block mb-1">Correction Details</span>
                                  <p className="text-xs text-gray-800 whitespace-pre-wrap">{selectedRequest.correctionNote}</p>
                                </div>
                              )}
                            </div>
                          </div>

                          {hasSystemSatisfiedCorrection && (
                            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800">
                              Government ID verification is handled separately and does not require a replacement file here.
                            </div>
                          )}

                          {loadingCorrectionReqs ? (
                            <div className="space-y-3 pt-2">
                              <Skeleton className="h-16 w-full rounded" />
                            </div>
                          ) : correctionReqsList.length === 0 ? (
                            <p className="text-xs text-gray-500 italic">No requirement corrections specified.</p>
                          ) : (
                            <div className="space-y-4 pt-2">
                              {correctionReqsList.map(req => {
                                const existingFile = selectedRequest.attachments?.find(a => a.category === req.id);
                                const selectedFile = uploadedFilesByCorrectionReq[req.id];
                                const replacementUploaded = uploadedCorrectionReqIds[req.id];
                                const fileUrl = existingFile ? `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/${existingFile.r2ObjectKey}` : null;

                                return (
                                  <div key={req.id} className="p-4 bg-white border border-border rounded-xl space-y-3 shadow-xs">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="text-xs font-bold text-gray-800 block">{req.label}</span>
                                        {req.description && <p className="text-[10px] text-gray-500 mt-0.5">{req.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {(selectedFile || replacementUploaded) && (
                                          <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                            <CheckCircle2 size={10} /> {replacementUploaded ? 'Uploaded' : 'Selected'}
                                          </span>
                                        )}
                                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          Correction Needed
                                        </span>
                                      </div>
                                    </div>

                                    {correctionInputErrors[req.id] && (
                                      <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
                                        {correctionInputErrors[req.id]}
                                      </div>
                                    )}

                                    {existingFile && (
                                      <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-150 rounded-lg text-xs">
                                        <div className="flex flex-col min-w-0">
                                          <span className="truncate max-w-[280px] font-medium text-gray-700">
                                            Current: {existingFile.fileName}
                                          </span>
                                          <span className="text-[10px] text-gray-400 mt-0.5">
                                            Uploaded: {new Date(existingFile.uploadedAt).toLocaleDateString()}
                                          </span>
                                        </div>
                                        {fileUrl && (
                                          <a
                                            href={fileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-crimson hover:underline font-bold text-xs cursor-pointer flex-shrink-0 ml-4 focus-ring rounded"
                                          >
                                            View
                                          </a>
                                        )}
                                      </div>
                                    )}

                                    {replacementUploaded ? (
                                      <div className="p-2.5 bg-green-50 border border-green-200 rounded-lg text-xs font-semibold text-green-800">
                                        Replacement uploaded. It will be included when this correction cycle is resubmitted.
                                      </div>
                                    ) : selectedFile ? (
                                      <div className="flex items-center justify-between p-2.5 bg-green-50/50 border border-green-200 rounded-lg text-xs">
                                        <span className="truncate max-w-[280px] font-mono font-semibold text-green-800">
                                          New: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => setUploadedFilesByCorrectionReq(prev => {
                                            const copy = { ...prev };
                                            delete copy[req.id];
                                            return copy;
                                          })}
                                          className="text-crimson hover:underline font-bold text-xs cursor-pointer focus-ring rounded"
                                        >
                                          Remove
                                        </button>
                                      </div>
                                    ) : (
                                      <label
                                        htmlFor={`correction-file-${req.id}`}
                                        onDragOver={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                        }}
                                        onDrop={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          const dropped = e.dataTransfer.files?.[0];
                                          if (dropped) {
                                            handleCorrectionFileSelect(req.id, dropped);
                                          }
                                        }}
                                        className="relative border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-lg p-4 text-center transition-colors bg-white cursor-pointer block focus-within:ring-2 focus-within:ring-crimson"
                                      >
                                        <input
                                          id={`correction-file-${req.id}`}
                                          type="file"
                                          onChange={(e) => {
                                            const selected = e.target.files?.[0];
                                            if (selected) {
                                              handleCorrectionFileSelect(req.id, selected);
                                            }
                                            e.target.value = '';
                                          }}
                                          className="sr-only"
                                          accept={(req.id.startsWith('registrant_id_') ? UPLOAD_POLICIES.REGISTRANT_ID_IMAGE : req.id === 'authorization_letter' ? UPLOAD_POLICIES.AUTHORIZATION_LETTER : UPLOAD_POLICIES.CORRECTION_DOCUMENT).acceptAttribute}
                                        />
                                        <span className="text-xs text-text-muted block">
                                          {req.id.startsWith('registrant_id_') ? 'Choose a JPEG or PNG replacement image - up to 5 MB.' : req.id === 'authorization_letter' ? 'Choose a PDF, JPEG, or PNG replacement - up to 5 MB.' : 'Drag and drop files here, or click to upload. PDF, JPG, PNG, or WebP - up to 5 MB.'}
                                        </span>
                                      </label>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {correctionError && (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-800 font-medium">
                              {correctionError}
                            </div>
                          )}

                          {correctionSuccess && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-xs text-green-800 font-medium">
                              Corrected documents submitted successfully! Awaiting parish review.
                            </div>
                          )}

                          <div className="flex justify-end pt-2">
                            <Button
                              onClick={async () => {
                                if (correctionSubmitInFlightRef.current) return;
                                correctionSubmitInFlightRef.current = true;
                                setSubmittingCorrections(true);
                                setCorrectionError(null);
                                let succeededCount = Object.keys(uploadedCorrectionReqIds).length;
                                const entries = Object.entries(uploadedFilesByCorrectionReq);
                                const totalCount = correctionReqsList.length;

                                try {
                                  for (const [reqId, file] of entries) {
                                    if (reqId === 'registrant_id_front') {
                                      await services.request.uploadRegistrantId(selectedRequest.id, { front: file });
                                    } else if (reqId === 'registrant_id_back') {
                                      await services.request.uploadRegistrantId(selectedRequest.id, { back: file });
                                    } else {
                                      await services.request.uploadFiles(selectedRequest.id, [file], reqId);
                                    }
                                    succeededCount++;
                                    setUploadedCorrectionReqIds(prev => ({ ...prev, [reqId]: true }));
                                    setUploadedFilesByCorrectionReq(prev => {
                                      const copy = { ...prev };
                                      delete copy[reqId];
                                      return copy;
                                    });
                                  }
                                  const res = await services.request.resubmitCorrections(selectedRequest.id);
                                  setCorrectionSuccess(true);
                                  setUploadedFilesByCorrectionReq({});
                                  setUploadedCorrectionReqIds({});
                                  setSearchedRequest(res);
                                  setSelectedRequestId(String(res.id));
                                  void refetch();
                                } catch (err: any) {
                                  console.error('Correction submission error:', err);
                                  try {
                                    await refetch();
                                    const updatedReq = await services.request.getRequestById(selectedRequest.id);
                                    if (updatedReq) {
                                      setSearchedRequest(updatedReq);
                                    }
                                  } catch (refetchErr) {
                                    console.error('Failed to refetch state after correction error:', refetchErr);
                                  }

                                  const errMsg = err.response?.data?.message || err.message || "Failed to submit corrections.";
                                  if (succeededCount > 0 && succeededCount < totalCount) {
                                    setCorrectionError(`${succeededCount} of ${totalCount} replacement files were uploaded, but a subsequent upload failed: ${errMsg}. Please select and retry the remaining files.`);
                                  } else if (totalCount > 0 && succeededCount === totalCount) {
                                    setCorrectionError(`All replacement files were uploaded, but final resubmission failed: ${errMsg}. Please click 'Submit Corrections' again.`);
                                  } else {
                                    setCorrectionError(errMsg);
                                  }
                                } finally {
                                  correctionSubmitInFlightRef.current = false;
                                  setSubmittingCorrections(false);
                                }
                              }}
                              disabled={
                                submittingCorrections ||
                                correctionSuccess ||
                                correctionReqsList.some(req => !uploadedFilesByCorrectionReq[req.id] && !uploadedCorrectionReqIds[req.id])
                              }
                              loading={submittingCorrections}
                              className="bg-amber-700 hover:bg-amber-800 text-white font-bold"
                            >
                              Submit Corrections
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Rejection / Resubmit Notice */}
                      {selectedRequest.status === 'rejected' && (
                        <div className="p-4 bg-red-50 border border-status-rejected/30 rounded-card space-y-3 text-left">
                          <div className="flex items-start space-x-2.5">
                            <AlertCircle size={16} className="text-status-rejected mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="text-xs font-bold text-status-rejected">Request Rejected</h4>
                              <p className="text-xs text-red-800 mt-1 leading-relaxed font-normal">
                                {selectedRequest.rejectionReason || 'The submitted requirements do not match canonical records or are illegible.'}
                              </p>
                              {selectedRequest.instructions && (
                                <p className="text-xs text-red-800 mt-2 font-medium">
                                  Instructions: {selectedRequest.instructions}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => {
                                requireCompleteProfile(
                                  () => navigate(`/dashboard/request?parishId=${selectedRequest.parishId}`),
                                  'request certificates'
                                );
                              }}
                            >
                              Resubmit New Request
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Processing History & Expected Process Timeline */}
                      {selectedRequest.status !== 'rejected' && (
                        <div className="space-y-4 pt-2">
                          <div className="flex items-center justify-between border-b border-border/40 pb-2">
                            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                              {selectedRequest.requestHistory && selectedRequest.requestHistory.length > 0
                                ? 'Activity Log & Process History'
                                : 'Processing Stage & Expected Process'
                              }
                            </h3>
                            <span className="text-[10px] text-text-muted font-mono uppercase">
                              {selectedRequest.requestHistory && selectedRequest.requestHistory.length > 0 ? 'Verified Record' : 'Standard Workflow'}
                            </span>
                          </div>

                          <div className="relative border-l-2 border-border/80 pl-6 ml-3 space-y-6 py-2">
                            {selectedRequest.requestHistory && selectedRequest.requestHistory.length > 0 ? (
                              selectedRequest.requestHistory.map((h) => {
                                const dateStr = new Date(h.createdAt).toLocaleDateString(undefined, {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                });
                                return (
                                  <div key={h.id} className="relative text-left">
                                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-crimson bg-crimson text-white flex items-center justify-center">
                                      <CheckCircle2 size={10} className="stroke-[3]" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-text-primary">
                                        {h.remarks || h.action.replace(/_/g, ' ')}
                                      </h4>
                                      <p className="text-[10px] text-text-muted mt-0.5">
                                        {dateStr} {h.actor?.fullName ? `by ${h.actor.fullName}` : ''}
                                      </p>
                                    </div>
                                  </div>
                                );
                              })
                            ) : (
                              getExpectedProcessMilestones(selectedRequest.status).map((mile) => (
                                <div key={mile.key} className="relative">
                                  {/* Circle Marker */}
                                  <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                                    mile.done
                                      ? 'border-crimson bg-crimson text-white'
                                      : 'border-border text-text-muted'
                                  }`}>
                                    {mile.done && <CheckCircle2 size={10} className="stroke-[3]" />}
                                  </div>

                                  <div>
                                    <h4 className={`text-xs font-bold ${mile.done ? 'text-text-primary' : 'text-text-muted'}`}>
                                      {mile.label}
                                    </h4>
                                    <p className="text-[11px] text-text-muted mt-0.5 font-normal">
                                      {mile.desc}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )
              ) : (
                searchCompleted && searchError ? (
                  <EmptyState
                    title="No matching request found"
                    description="We could not find any sacramental registry document request matching that reference key. Please verify the code or check your submissions list on the left."
                    icon={<AlertCircle size={40} className="text-text-muted/40" />}
                    action={
                      <Button size="sm" onClick={() => {
                        setSelectedRequestId(requests[0] ? String(requests[0].id) : null);
                        setSearchedRequest(null);
                        setSearchCompleted(false);
                        setSearchError(false);
                        setSearchQuery('');
                      }}>
                        Clear Search &amp; View Submissions
                      </Button>
                    }
                  />
                ) : (
                  <Card className="flex items-center justify-center p-12 text-center text-text-muted h-96">
                    Select a request tracking number from the list or search above to view current status and details.
                  </Card>
                )
              )}
            </section>
          </div>

        </>
      )}
        </div>
      ) : (
        <div
          id="tracking-mode-panel-schedules"
          role="tabpanel"
          aria-labelledby="tracking-mode-tab-schedules"
          className="space-y-6"
        >
          {/* Mobile Tab Switcher (<1024px) for Schedule Tracking */}
          <div
            className="flex lg:hidden bg-app-page p-1 rounded-card border border-border"
            role="tablist"
            aria-label="Schedule tracking views"
          >
            <button
              id="schedule-tab-list"
              type="button"
              onClick={() => setMobileScheduleView('schedules')}
              role="tab"
              aria-selected={mobileScheduleView === 'schedules'}
              aria-controls="schedule-panel-list"
              className={`flex-1 py-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-1.5 focus-ring ${
                mobileScheduleView === 'schedules'
                  ? 'bg-white text-crimson shadow-xs border border-border/50'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Calendar size={14} />
              <span>My Schedules ({schedules.length})</span>
            </button>
            <button
              id="schedule-tab-details"
              type="button"
              onClick={() => setMobileScheduleView('details')}
              disabled={!selectedSchedule}
              role="tab"
              aria-selected={mobileScheduleView === 'details'}
              aria-controls="schedule-panel-details"
              className={`flex-1 py-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-1.5 focus-ring disabled:opacity-40 ${
                mobileScheduleView === 'details'
                  ? 'bg-white text-crimson shadow-xs border border-border/50'
                  : 'text-gray-600 hover:text-text-primary'
              }`}
            >
              <Clock size={14} />
              <span>Schedule Details</span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Side: Search & Schedules List (Col-span 5 on desktop) */}
            <section
              id={isMobile ? "schedule-panel-list" : undefined}
              role={isMobile ? "tabpanel" : undefined}
              aria-labelledby={isMobile ? "schedule-tab-list" : undefined}
              aria-label={!isMobile ? "My Scheduled Requests" : undefined}
              className={`flex flex-col gap-6 ${mobileScheduleView === 'details' ? 'hidden lg:flex lg:col-span-5' : 'flex lg:col-span-5'}`}
            >
              {/* Search Form */}
              <div className="bg-white rounded-card border border-border p-5 shadow-xs transition-all duration-fast">
                <form onSubmit={handleScheduleSearch} className="space-y-3">
                  <div className="space-y-1">
                    <label htmlFor="search-schedule-input" className="block text-xs font-bold text-text-primary uppercase tracking-wider">
                      Schedule Request / Confirmation Number
                    </label>
                    <p className="text-[11px] text-gray-600">Enter your confirmation number (e.g. CONF-2026-0026) or schedule ID.</p>
                  </div>
                  <div className="flex gap-2">
                    <SearchInput
                      id="search-schedule-input"
                      placeholder="e.g. CONF-2026-0026"
                      value={scheduleSearchQuery}
                      onChange={e => setScheduleSearchQuery(e.target.value)}
                      aria-label="Schedule request reference or confirmation number"
                    />
                    <Button type="submit" size="sm" className="font-semibold" disabled={scheduleSearching}>
                      {scheduleSearching ? <Loader2 size={14} className="animate-spin" /> : 'Search'}
                    </Button>
                  </div>
                </form>
              </div>

              {/* Schedules List */}
              <div className="bg-white rounded-card border border-border p-5 shadow-xs">
                <div className="mb-3.5 border-b border-border pb-2.5 flex justify-between items-center">
                  <h2 className="text-sm font-bold text-text-primary">My Schedule Requests</h2>
                  {loadingSchedules && <Loader2 size={14} className="animate-spin text-crimson" />}
                </div>
                {schedules.length === 0 ? (
                  <div className="text-center py-6 text-xs text-text-muted">
                    No schedule appointments booked yet.
                  </div>
                ) : (
                  <div className="space-y-2.5 pt-0">
                    {schedules.map(sched => {
                      const isSelected = selectedSchedule?.id === sched.id;
                      return (
                        <button
                          key={sched.id}
                          type="button"
                          onClick={() => handleSelectSchedule(sched)}
                          className={`w-full p-3.5 rounded-button border text-left transition-all focus-ring relative group cursor-pointer ${
                            isSelected
                              ? 'border-crimson bg-red-50/20 shadow-xs'
                              : 'border-border/80 hover:bg-app-page hover:border-gray-300'
                          }`}
                          aria-current={isSelected ? 'true' : undefined}
                        >
                          <div className="flex justify-between items-center gap-2 mb-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <Calendar size={14} className={isSelected ? 'text-crimson flex-shrink-0' : 'text-text-muted flex-shrink-0'} />
                              <span className="text-xs font-mono font-bold text-text-primary truncate">
                                {sched.confirmationNumber}
                              </span>
                            </div>
                            <Badge variant={getScheduleBadgeVariant(sched.status)}>
                              {formatScheduleStatusDisplay(sched.status, sched.priestResponseStatus)}
                            </Badge>
                          </div>
                          <p className="text-xs font-semibold text-text-primary truncate">
                            {sched.serviceName}
                          </p>
                          <div className="flex justify-between items-center text-[11px] text-gray-600 mt-1">
                            <span>{sched.parishName || 'Parish'}</span>
                            <span>{sched.date}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {/* Right Side: Details & Milestones & Reschedule History */}
            <section
              id={isMobile ? "schedule-panel-details" : undefined}
              role={isMobile ? "tabpanel" : undefined}
              aria-labelledby={isMobile ? "schedule-tab-details" : undefined}
              aria-label={!isMobile ? "Schedule Request Details" : undefined}
              className={`flex-1 ${mobileScheduleView === 'schedules' ? 'hidden lg:block lg:col-span-7' : 'block lg:col-span-7'}`}
            >
              {scheduleSearching ? (
                <Card className="p-8 text-center text-text-muted flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-crimson" />
                  <p className="text-sm font-semibold">Checking schedule status...</p>
                </Card>
              ) : scheduleSearchError ? (
                <EmptyState
                  title="Schedule not found"
                  description={scheduleSearchError}
                  icon={<AlertCircle size={40} className="text-text-muted/40" />}
                  action={
                    <Button size="sm" onClick={() => {
                      setScheduleSearchQuery('');
                      setScheduleSearchError(null);
                    }}>
                      Clear Search
                    </Button>
                  }
                />
              ) : selectedSchedule ? (
                <div className="space-y-6">
                  {/* Status & Reference Header Card */}
                  <Card className="p-5 sm:p-6 shadow-xs border-border">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4 mb-4">
                      <div>
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest block">
                          Schedule Reference
                        </span>
                        <h2 className="text-base sm:text-lg font-mono font-bold text-text-primary">
                          {selectedSchedule.confirmationNumber}
                        </h2>
                      </div>
                      <div>
                        <Badge variant={getScheduleBadgeVariant(selectedSchedule.status)}>
                          {formatScheduleStatusDisplay(selectedSchedule.status, selectedSchedule.priestResponseStatus)}
                        </Badge>
                      </div>
                    </div>

                    {/* Milestones Progression */}
                    <div className="space-y-4 pt-2">
                      <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                        Progress Milestones
                      </h3>
                      <div className="space-y-4 pl-1">
                        {getScheduleMilestones(selectedSchedule).map((mile) => (
                          <div key={mile.key} className="relative pl-6 pb-4 last:pb-0 border-l-2 border-border/80 last:border-l-transparent">
                            <div className={`absolute -left-[9px] top-0.5 w-4 h-4 rounded-full flex items-center justify-center border-2 transition-all ${
                              mile.done
                                ? 'border-crimson bg-crimson text-white'
                                : 'border-border text-text-muted bg-white'
                            }`}>
                              {mile.done && <CheckCircle2 size={10} className="stroke-[3]" />}
                            </div>
                            <div>
                              <h4 className={`text-xs font-bold ${mile.done ? 'text-text-primary' : 'text-text-muted'}`}>
                                {mile.label}
                              </h4>
                              <p className="text-[11px] text-text-muted mt-0.5 font-normal">
                                {mile.desc}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </Card>

                  {/* Schedule Details Card */}
                  <Card className="p-5 sm:p-6 shadow-xs border-border">
                    <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider border-b border-border pb-3 mb-4">
                      Schedule Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Service</span>
                        <p className="font-semibold text-text-primary flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                          {selectedSchedule.serviceName}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Parish</span>
                        <p className="font-semibold text-text-primary flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                          {selectedSchedule.parishName || `Parish #${selectedSchedule.parishId}`}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Scheduled Date</span>
                        <p className="font-semibold text-text-primary">{selectedSchedule.date}</p>
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Time Slot</span>
                        <p className="font-semibold text-text-primary">{selectedSchedule.timeSlot}</p>
                      </div>

                      <div className="space-y-1 sm:col-span-2">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Assigned Priest</span>
                        <p className="font-semibold text-text-primary flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                          {selectedSchedule.assignedPriestName ? `Rev. Fr. ${selectedSchedule.assignedPriestName}` : 'Pending assignment by parish'}
                        </p>
                        {selectedSchedule.assignedPriestName && selectedSchedule.priestResponseStatus === 'PENDING' && (
                          <p className="text-[11px] text-blue-700 bg-blue-50 px-2.5 py-1 rounded border border-blue-100 inline-block mt-1">
                            Priest Response: Awaiting Acceptance
                          </p>
                        )}
                      </div>

                      <div className="space-y-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Confirmation No.</span>
                        <p className="font-mono text-xs font-bold text-text-primary">{selectedSchedule.confirmationNumber}</p>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-border flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate(`/dashboard/schedule/${selectedSchedule.id}`)}
                        className="gap-1.5"
                      >
                        <span>Open Full Schedule Details</span>
                        <ArrowRight size={14} />
                      </Button>
                    </div>
                  </Card>

                  {/* Reschedule History (Reusing shared component!) */}
                  {selectedSchedule.rescheduleHistory && selectedSchedule.rescheduleHistory.length > 0 && (
                    <ScheduleRescheduleHistory history={selectedSchedule.rescheduleHistory} />
                  )}
                </div>
              ) : (
                <Card className="flex items-center justify-center p-12 text-center text-text-muted h-96">
                  Select a schedule request from the list or enter a confirmation number above to view status.
                </Card>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestTrackingPage;
