import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertCircle, FileText } from 'lucide-react';
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

const getBadgeVariant = (status: any): 'pending' | 'under-review' | 'ready' | 'rejected' | 'neutral' | 'crimson' => {
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
    case 'payment-needs-correction':
      return 'rejected';
    default:
      return 'under-review';
  }
};

const formatStatusDisplay = (status: string) => {
  if (status === 'payment-under-review') return 'Awaiting Payment Review';
  if (status === 'payment-needs-correction') return 'Payment Needs Correction';
  if (status === 'needs-correction' || status === 'needs_correction') return 'Needs Correction';
  return status;
};

export const RequestTrackingPage: React.FC = () => {
  const navigate = useNavigate();

  const requestsQuery = useRequests();
  const requests = requestsQuery.data || [];
  const { loading, error, refetch } = requestsQuery;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<SacramentalRequest | null>(null);
  const [searchError, setSearchError] = useState(false);
  const [searchCompleted, setSearchCompleted] = useState(false);

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

  // Sync selected request on initial load or query param change
  useEffect(() => {
    if (requests.length > 0) {
      if (paramRequestId) {
        const found = requests.find(r => String(r.id) === paramRequestId);
        if (found) {
          setSelectedRequest(found);
          return;
        } else {
          // Gracefully redirect to Notification Center if the resource no longer exists
          navigate('/dashboard/notifications');
          return;
        }
      }
      if (!selectedRequest) {
        setSelectedRequest(requests[0]);
      }
    }
  }, [requests, selectedRequest, paramRequestId, navigate]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchError(false);
    setSearchCompleted(true);
    try {
      const match = await services.request.getRequestByTrackingNumber(searchQuery.trim());
      if (match) {
        setSelectedRequest(match);
      } else {
        setSelectedRequest(null);
        setSearchError(true);
      }
    } catch (err) {
      console.error(err);
      setSelectedRequest(null);
      setSearchError(true);
    }
  };

  const getTimelineMilestones = (status: RequestStatus) => {
    const milestones = [
      { key: 'created', label: 'Created', done: true },
      { key: 'received', label: 'Received', done: status !== 'pending' },
      { key: 'validated', label: 'Validated', done: status === 'ready' || status === 'under-review' },
      { key: 'reviewed', label: 'Reviewed', done: status === 'ready' || status === 'under-review' },
      { key: 'signed', label: 'Signed', done: status === 'ready' },
      { key: 'pickup', label: 'Ready for Pickup', done: status === 'ready' }
    ];
    return milestones;
  };

  const handleSelectRequest = (req: SacramentalRequest) => {
    setSelectedRequest(req);
    setSearchQuery('');
    setSearchError(false);
    setSearchCompleted(false);
  };

  const handleRefresh = () => {
    setSearchQuery('');
    setSearchError(false);
    setSearchCompleted(false);
    setSelectedRequest(null);
    refetch();
  };

  const handleOptimisticPaymentUpload = (updatedRequest?: SacramentalRequest) => {
    if (updatedRequest) {
      setSelectedRequest(updatedRequest);
    } else if (selectedRequest) {
      const fallbackRequest = { ...selectedRequest, status: 'payment-under-review' as RequestStatus };
      setSelectedRequest(fallbackRequest);
    }
    refetch();
  };

  if (error) {
    return (
      <div className="space-y-6">
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
      <div className="space-y-6" aria-busy="true">
        <PageHeader 
          title="Track Request Status" 
          description="Search via your reference number or view existing requests below."
          onRefresh={handleRefresh}
          isRefreshing={true}
          breadcrumbs={['Home', 'Request Tracking']}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Search & Submissions (Col-span 5) */}
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

          {/* Right Side: Details & Timeline (Col-span 7) */}
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
    <div className="space-y-6" aria-live="polite">
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
            <Button onClick={() => navigate('/dashboard/request')} className="bg-crimson hover:bg-crimson-dark">
              Request a Document
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Side: Search & Submissions (Col-span 5) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Search Form */}
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handleSearch} className="space-y-4">
                  <div className="space-y-1">
                    <label className="block text-xs font-semibold text-text-primary uppercase tracking-wider">
                      Search Tracking Number
                    </label>
                    <p className="text-[10px] text-text-muted">Enter the TX reference number generated during request submission.</p>
                  </div>
                  <div className="flex space-x-2">
                    <SearchInput
                      placeholder="e.g. TX-2026-88401"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                    />
                    <Button type="submit" size="sm">Search</Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            {/* Submissions List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">My Submitted Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {requests.map(req => {
                  const isSelected = selectedRequest?.id === req.id;
                  return (
                    <div
                      key={req.id}
                      onClick={() => handleSelectRequest(req)}
                      className={`p-3 rounded-button border cursor-pointer transition-colors space-y-2 text-left ${
                        isSelected 
                          ? 'border-crimson bg-red-50/15' 
                          : 'border-border/60 hover:bg-app-page'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-mono font-semibold text-text-primary">
                          {req.trackingNumber}
                        </span>
                        <Badge variant={getBadgeVariant(req.status)}>
                          {formatStatusDisplay(req.status)}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-text-muted">
                        <span className="capitalize">{req.documentType} Certificate</span>
                        <span>Updated: {new Date(req.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right Side: Details & Timeline (Col-span 7) */}
          <div className="lg:col-span-7">
            {selectedRequest ? (
              selectedRequest.status === 'payment-pending' ? (
                <div className="space-y-6 animate-in fade-in duration-200">
                  {/* Payment Required banner card */}
                  <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm text-left">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-bold uppercase rounded-full tracking-wider border border-amber-200/50">
                          Payment Required
                        </span>
                        <span className="font-mono text-xs font-semibold text-text-primary">
                          {selectedRequest.trackingNumber}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-text-primary">Sacramental registry fees are pending verification</h3>
                      <p className="text-xs text-text-muted font-normal max-w-xl leading-relaxed">
                        Your request for a <span className="font-semibold text-text-primary capitalize">{selectedRequest.documentType} Certificate</span> has been reviewed and requires a certificate processing fee. Please follow the instructions to upload payment receipt.
                      </p>
                    </div>
                    <div className="text-left bg-white p-3.5 rounded-xl border border-amber-100 min-w-[140px] flex flex-col justify-center shadow-xs">
                      <span className="text-[9px] text-text-muted uppercase font-bold tracking-wider">Amount Due</span>
                      <span className="text-xl font-extrabold text-crimson mt-0.5">
                        {(() => {
                          const fee = selectedRequest.fee !== undefined && selectedRequest.fee !== null && !isNaN(selectedRequest.fee)
                            ? selectedRequest.fee
                            : (selectedRequest.paymentTransactions?.[0]?.amount ? Number(selectedRequest.paymentTransactions[0].amount) : 100);
                          return `₱${Number(fee).toFixed(2)}`;
                        })()}
                      </span>
                    </div>
                  </div>

                  {/* Side-by-side Layout */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PaymentInstructionsCard 
                      parishId={selectedRequest.parishId} 
                      amount={
                        selectedRequest.fee !== undefined && selectedRequest.fee !== null && !isNaN(selectedRequest.fee)
                          ? selectedRequest.fee
                          : (selectedRequest.paymentTransactions?.[0]?.amount ? Number(selectedRequest.paymentTransactions[0].amount) : 100)
                      } 
                    />
                    <ReceiptUploadCard
                      requestId={selectedRequest.id}
                      existingTransaction={selectedRequest.paymentTransactions?.[0]}
                      onSuccess={(updatedRequest) => handleOptimisticPaymentUpload(updatedRequest)}
                    />
                  </div>
                </div>
              ) : selectedRequest.status === 'payment-needs-correction' ? (
                <div className="space-y-6 animate-in fade-in duration-200 text-left">
                  {/* Correction Required Banner Card */}
                  <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-2xl space-y-4 text-left shadow-sm">
                    <div className="flex items-start space-x-2.5">
                      <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <h4 className="text-sm font-bold text-amber-800">Payment Correction Required</h4>
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed font-normal">
                          The secretary has requested a correction for your uploaded payment proof. Please review the note below and upload a replacement receipt.
                        </p>
                        
                        {selectedRequest.paymentCorrectionNote && (
                          <div className="mt-3 p-3 bg-white border border-amber-100 rounded-xl">
                            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">Secretary Note</span>
                            <p className="text-xs text-gray-700 italic">"{selectedRequest.paymentCorrectionNote}"</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Previous Receipt Reference */}
                    {selectedRequest.paymentTransactions?.[0]?.receipts?.[0] && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 bg-white border border-gray-150 rounded-xl text-xs gap-3">
                        <div className="flex flex-col min-w-0">
                          <span className="truncate max-w-[280px] font-semibold text-gray-700">
                            Rejected Receipt: {selectedRequest.paymentTransactions[0].receipts[0].fileName}
                          </span>
                          <span className="text-[9px] text-gray-400 mt-0.5">
                            Uploaded: {new Date(selectedRequest.paymentTransactions[0].receipts[0].uploadedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <a
                          href={`https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/${selectedRequest.paymentTransactions[0].receipts[0].r2ObjectKey}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-1.5 bg-[#7B1C2A] text-white hover:bg-[#9B2C3A] text-xs font-bold rounded-lg transition-all text-center"
                        >
                          View Receipt
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Replacement Upload component below */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <PaymentInstructionsCard parishId={selectedRequest.parishId} />
                    <ReceiptUploadCard
                      requestId={selectedRequest.id}
                      existingTransaction={undefined} /* Force upload dropzone mode */
                      onSuccess={(updatedRequest) => handleOptimisticPaymentUpload(updatedRequest)}
                    />
                  </div>
                </div>
              ) : (
                <Card className="space-y-6">
                  <CardHeader className="flex flex-col sm:flex-row justify-between sm:items-center space-y-2 sm:space-y-0 pb-4 border-b border-border">
                    <div className="space-y-1">
                      <span className="text-[10px] text-text-muted font-bold tracking-wider uppercase">Active Tracking details</span>
                      <CardTitle className="font-mono text-xl">{selectedRequest.trackingNumber}</CardTitle>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-text-muted capitalize">{selectedRequest.documentType} Document</span>
                      <Badge variant={getBadgeVariant(selectedRequest.status)}>{formatStatusDisplay(selectedRequest.status)}</Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-6 pt-0">
                    {/* Request Details */}
                    <div className="grid grid-cols-2 gap-4 text-xs bg-app-page p-4 rounded-card border border-border/40">
                      <div>
                        <span className="text-text-muted block font-semibold uppercase tracking-wider text-[9px] mb-0.5">Applicant</span>
                        <span className="font-semibold text-text-primary">{selectedRequest.applicantName}</span>
                      </div>
                      <div>
                        <span className="text-text-muted block font-semibold uppercase tracking-wider text-[9px] mb-0.5">Relationship</span>
                        <span className="font-semibold text-text-primary">{selectedRequest.relationship}</span>
                      </div>
                      <div className="col-span-2 pt-2 border-t border-border/40">
                        <span className="text-text-muted block font-semibold uppercase tracking-wider text-[9px] mb-0.5">Purpose</span>
                        <p className="text-text-primary leading-relaxed">{selectedRequest.purpose}</p>
                      </div>

                      {/* Payment, Verification, OCR details */}
                      {selectedRequest.paymentStatus && (
                        <div className="col-span-2 pt-2 border-t border-border/40 grid grid-cols-2 gap-3 text-xs text-left">
                          <div>
                            <span className="text-text-muted block font-semibold uppercase tracking-wider text-[9px] mb-0.5">Payment Status</span>
                            <span className="font-semibold text-text-primary capitalize">{selectedRequest.paymentStatus.toLowerCase()}</span>
                          </div>
                          {selectedRequest.paymentTransactions && selectedRequest.paymentTransactions.length > 0 && (
                            <>
                              <div>
                                <span className="text-text-muted block font-semibold uppercase tracking-wider text-[9px] mb-0.5">Reference No</span>
                                <span className="font-semibold text-text-primary font-mono">{selectedRequest.paymentTransactions[0].referenceNumber || 'N/A'}</span>
                              </div>
                              <div>
                                <span className="text-text-muted block font-semibold uppercase tracking-wider text-[9px] mb-0.5">Amount Detected</span>
                                <span className="font-semibold text-text-primary">
                                  {selectedRequest.paymentTransactions[0].amount ? `₱${selectedRequest.paymentTransactions[0].amount}` : 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-text-muted block font-semibold uppercase tracking-wider text-[9px] mb-0.5">Verification Date</span>
                                <span className="font-semibold text-text-primary">
                                  {selectedRequest.paymentTransactions[0].verifiedAt 
                                    ? new Date(selectedRequest.paymentTransactions[0].verifiedAt).toLocaleDateString() 
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
                      <div className="p-5 bg-amber-50/60 border border-amber-200 rounded-card space-y-4 text-left">
                        <div className="flex items-start space-x-2.5">
                          <AlertCircle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-amber-800">Correction Required</h4>
                            <p className="text-xs text-amber-700 mt-1 leading-relaxed font-normal">
                              The secretary has requested correction for the following document requirement(s). Only the selected documents require replacement.
                            </p>
                            {selectedRequest.correctionNote && (
                              <div className="mt-3 p-3 bg-white border border-amber-100 rounded-xl">
                                <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest block mb-1">Secretary Note</span>
                                <p className="text-xs text-gray-700 italic">"{selectedRequest.correctionNote}"</p>
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
                                <div key={req.id} className="p-4 bg-white border border-gray-150 rounded-xl space-y-3 shadow-sm">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className="text-xs font-bold text-gray-800 block">{req.label}</span>
                                      {req.description && <p className="text-[10px] text-gray-400 mt-0.5">{req.description}</p>}
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                      {selectedFile && (
                                        <span className="text-[9px] bg-green-50 text-green-700 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
                                          <CheckCircle2 size={10} /> Selected
                                        </span>
                                      )}
                                      <span className="text-[9px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                        Correction Needed
                                      </span>
                                    </div>
                                  </div>

                                  {existingFile && (
                                    <div className="flex items-center justify-between p-2.5 bg-gray-50 border border-gray-100 rounded-lg text-xs">
                                      <div className="flex flex-col min-w-0">
                                        <span className="truncate max-w-[280px] font-medium text-gray-600">
                                          Current: {existingFile.fileName}
                                        </span>
                                        <span className="text-[9px] text-gray-400 mt-0.5">
                                          Uploaded: {new Date(existingFile.uploadedAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                      {fileUrl && (
                                        <a
                                          href={fileUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-crimson hover:underline font-bold text-xs cursor-pointer flex-shrink-0 ml-4"
                                        >
                                          View
                                        </a>
                                      )}
                                    </div>
                                  )}

                                  {selectedFile ? (
                                    <div className="flex items-center justify-between p-2.5 bg-green-50/30 border border-green-200/50 rounded-lg text-xs">
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
                                        className="text-crimson hover:underline font-bold text-xs cursor-pointer"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="relative border border-dashed border-gray-300 hover:border-amber-500 rounded-lg p-4 text-center transition-colors bg-white">
                                      <input
                                        type="file"
                                        onChange={(e) => {
                                          const selected = e.target.files?.[0];
                                          if (selected) {
                                            setUploadedFilesByCorrectionReq(prev => ({ ...prev, [req.id]: selected }));
                                          }
                                        }}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        accept=".png,.jpg,.jpeg,.pdf"
                                      />
                                      <span className="text-xs text-gray-400">Click or drag a new file to replace</span>
                                    </div>
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
                            Corrected documents submitted successfully! Awaiting review.
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
                                setSelectedRequest(res);
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
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold"
                          >
                            Submit Corrections
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Rejection / Resubmit Condition */}
                    {selectedRequest.status === 'rejected' && (
                      <div className="p-4 bg-red-50 border border-status-rejected/20 rounded-card space-y-3">
                        <div className="flex items-start space-x-2.5">
                          <AlertCircle size={16} className="text-status-rejected mt-0.5 flex-shrink-0" />
                          <div>
                            <h4 className="text-xs font-semibold text-status-rejected">Request Rejected</h4>
                            <p className="text-xs text-red-700 mt-1 leading-relaxed font-normal">
                              {selectedRequest.rejectionReason || 'The submitted requirements do not match canonical records or are illegible.'}
                            </p>
                            {selectedRequest.instructions && (
                              <p className="text-xs text-red-700 mt-2 font-medium">
                                Instructions: {selectedRequest.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <Button size="sm" variant="danger" onClick={() => navigate(`/dashboard/request?parishId=${selectedRequest.parishId}`)}>
                            Resubmit Request
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Timeline */}
                    {selectedRequest.status !== 'rejected' && (
                      <div className="space-y-4">
                        <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                          Processing Status Timeline
                        </h3>
                        <div className="relative border-l-2 border-border pl-6 ml-3 space-y-6 py-2">
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
                                  <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 bg-white border-crimson bg-crimson text-white flex items-center justify-center">
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
                            getTimelineMilestones(selectedRequest.status).map((mile) => (
                              <div key={mile.key} className="relative">
                                {/* Circle marker */}
                                <div className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center ${
                                  mile.done 
                                    ? 'border-crimson bg-crimson text-white' 
                                    : 'border-border text-text-muted'
                                }`}>
                                  {mile.done && <CheckCircle2 size={10} className="stroke-[3]" />}
                                </div>
                                
                                <div>
                                  <h4 className={`text-xs font-semibold ${mile.done ? 'text-text-primary' : 'text-text-muted'}`}>
                                    {mile.label}
                                  </h4>
                                  <p className="text-[10px] text-text-muted mt-0.5">
                                    {mile.done 
                                      ? `Milestone successfully completed.` 
                                      : `Awaiting processing step.`}
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
                      setSelectedRequest(requests[0] || null);
                      setSearchCompleted(false);
                      setSearchError(false);
                      setSearchQuery('');
                    }} className="bg-crimson hover:bg-crimson-dark">
                      Clear Search & View Submissions
                    </Button>
                  }
                />
              ) : (
                <Card className="flex items-center justify-center p-12 text-center text-text-muted h-96">
                  Select a request tracking number from the list or search above to view current status timeline.
                </Card>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default RequestTrackingPage;
