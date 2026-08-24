import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, FileText, Clock, ArrowLeft } from 'lucide-react';
import services from '../../providers/factory';
import { useRequests } from '../../hooks/useService';
import type { SacramentalRequest, RequestStatus } from '../../types';
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

const EMPTY_REQUESTS: SacramentalRequest[] = [];

export const RequestTrackingPage: React.FC = () => {
  const navigate = useNavigate();

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


  // Correction Resubmission State
  const [correctionReqsList, setCorrectionReqsList] = useState<Array<{ id: string; label: string; required: boolean; description?: string }>>([]);
  const [loadingCorrectionReqs, setLoadingCorrectionReqs] = useState(false);
  const [uploadedFilesByCorrectionReq, setUploadedFilesByCorrectionReq] = useState<Record<string, File>>({});
  const [submittingCorrections, setSubmittingCorrections] = useState(false);
  const [correctionSuccess, setCorrectionSuccess] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);

  useEffect(() => {
    if (selectedRequest && (selectedRequest.status === 'needs-correction' || selectedRequest.status === 'needs_correction')) {
      setLoadingCorrectionReqs(true);
      setCorrectionError(null);
      setCorrectionSuccess(false);
      setUploadedFilesByCorrectionReq({});
      services.request.getDocumentRequirements(selectedRequest.documentType, selectedRequest.parishId)
        .then(res => {
          const reqs = res?.requiredDocuments || [];
          const selectedReqIds = selectedRequest.correctionRequirementIds || [];
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
  }, [selectedRequest]);

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

  return (
    <div className="space-y-6 text-left" aria-live="polite">
      <PageHeader
        title="Track Request Status"
        description="Search via your reference number or view existing requests below."
        onRefresh={handleRefresh}
        breadcrumbs={['Home', 'Request Tracking']}
      />

      {requests.length === 0 ? (
        <EmptyState
          title="No document requests yet"
          description="You have not submitted any certificate requests. Submit a document request using our wizard to start tracking."
          icon={<FileText size={48} className="text-text-muted/40" />}
          action={
            <Button onClick={() => navigate('/dashboard/request')}>
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
                  : 'text-text-muted hover:text-text-primary'
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
                  : 'text-text-muted hover:text-text-primary'
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
                    <p className="text-[11px] text-text-muted">Enter the TX reference code from your submission.</p>
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
                  <h3 className="text-sm font-bold text-text-primary">My Submitted Requests</h3>
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
                            ? 'border-crimson bg-red-50/20 border-l-4 border-l-crimson shadow-xs'
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
                        <div className="flex justify-between items-center text-[11px] text-text-muted">
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
                          <span className="text-text-muted block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Applicant</span>
                          <span className="font-bold text-text-primary">{selectedRequest.applicantName}</span>
                        </div>
                        <div>
                          <span className="text-text-muted block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Relationship</span>
                          <span className="font-bold text-text-primary">{selectedRequest.relationship}</span>
                        </div>
                        <div className="col-span-2 pt-2 border-t border-border/40">
                          <span className="text-text-muted block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Purpose</span>
                          <p className="text-text-primary leading-relaxed">{selectedRequest.purpose}</p>
                        </div>

                        {/* Payment Details if available */}
                        {selectedRequest.paymentStatus && (
                          <div className="col-span-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-3 text-xs text-left">
                            <div>
                              <span className="text-text-muted block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Payment Status</span>
                              <span className="font-bold text-text-primary capitalize">{selectedRequest.paymentStatus.toLowerCase()}</span>
                            </div>
                            {selectedRequest.paymentTransactions && selectedRequest.paymentTransactions.length > 0 && (
                              <>
                                <div>
                                  <span className="text-text-muted block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Reference No</span>
                                  <span className="font-mono font-bold text-text-primary">{selectedRequest.paymentTransactions[0].referenceNumber || 'N/A'}</span>
                                </div>
                                <div>
                                  <span className="text-text-muted block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Amount Detected</span>
                                  <span className="font-bold text-text-primary">
                                    {selectedRequest.paymentTransactions[0].amount ? `\u20B1${selectedRequest.paymentTransactions[0].amount}` : 'N/A'}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-text-muted block font-semibold uppercase tracking-wider text-[10px] mb-0.5">Verification</span>
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
                                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest block mb-1">Secretary Note</span>
                                  <p className="text-xs text-gray-800 italic">"{selectedRequest.correctionNote}"</p>
                                </div>
                              )}
                            </div>
                          </div>

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
                                const fileUrl = existingFile ? `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/${existingFile.r2ObjectKey}` : null;

                                return (
                                  <div key={req.id} className="p-4 bg-white border border-border rounded-xl space-y-3 shadow-xs">
                                    <div className="flex justify-between items-start">
                                      <div>
                                        <span className="text-xs font-bold text-gray-800 block">{req.label}</span>
                                        {req.description && <p className="text-[10px] text-gray-500 mt-0.5">{req.description}</p>}
                                      </div>
                                      <div className="flex items-center gap-1.5">
                                        {selectedFile && (
                                          <span className="text-[10px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                            <CheckCircle2 size={10} /> Selected
                                          </span>
                                        )}
                                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          Correction Needed
                                        </span>
                                      </div>
                                    </div>

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

                                    {selectedFile ? (
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
                                        className="relative border-2 border-dashed border-gray-300 hover:border-amber-500 rounded-lg p-4 text-center transition-colors bg-white cursor-pointer block focus-within:ring-2 focus-within:ring-crimson"
                                      >
                                        <input
                                          id={`correction-file-${req.id}`}
                                          type="file"
                                          onChange={(e) => {
                                            const selected = e.target.files?.[0];
                                            if (selected) {
                                              setUploadedFilesByCorrectionReq(prev => ({ ...prev, [req.id]: selected }));
                                            }
                                          }}
                                          className="sr-only"
                                          accept=".png,.jpg,.jpeg,.pdf"
                                        />
                                        <span className="text-xs font-semibold text-text-primary block">Click to select replacement file</span>
                                        <span className="text-[10px] text-text-muted mt-0.5 block">Supports PNG, JPG, JPEG, PDF</span>
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
                                setSubmittingCorrections(true);
                                setCorrectionError(null);
                                try {
                                  const entries = Object.entries(uploadedFilesByCorrectionReq);
                                  for (const [reqId, file] of entries) {
                                    await services.request.uploadFiles(selectedRequest.id, [file], reqId);
                                  }
                                  const res = await services.request.resubmitCorrections(selectedRequest.id);
                                  setCorrectionSuccess(true);
                                  setUploadedFilesByCorrectionReq({});
                                  setSearchedRequest(res);
                                  setSelectedRequestId(String(res.id));
                                  refetch();
                                } catch (err: any) {
                                  console.error(err);
                                  setCorrectionError(err.response?.data?.message || err.message || "Failed to submit corrections. Please check files and try again.");
                                } finally {
                                  setSubmittingCorrections(false);
                                }
                              }}
                              disabled={
                                submittingCorrections ||
                                correctionSuccess ||
                                correctionReqsList.some(req => !uploadedFilesByCorrectionReq[req.id])
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
                            <Button size="sm" variant="danger" onClick={() => navigate(`/dashboard/request?parishId=${selectedRequest.parishId}`)}>
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
  );
};

export default RequestTrackingPage;
