import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, X, Check, AlertCircle, FileText, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { DocumentRequestTable } from '@/components/document-requests/DocumentRequestTable';
import { getDocumentRequests, updateDocumentStatus } from '@/services/documentRequestService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { DocumentRequest, DocumentStatus, DocumentType } from '@/types';
import { cn } from '@/utils/cn';

const DOCUMENT_TYPE_OPTIONS: { label: string; value: DocumentType | 'all' }[] = [
  { label: 'All Document Types', value: 'all' },
  { label: 'Baptismal Certificate', value: 'Baptismal Certificate' },
  { label: 'Marriage Certificate', value: 'Marriage Certificate' },
  { label: 'Confirmation Certificate', value: 'Confirmation Certificate' },
  { label: 'Good Moral Character', value: 'Good Moral Character' },
  { label: 'Death Certificate', value: 'Death Certificate' },
];

const STATUS_OPTIONS: { label: string; value: DocumentStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending Review', value: 'Pending Review' },
  { label: 'Processing', value: 'Processing' },
  { label: 'Ready for Pickup', value: 'Ready for Pickup' },
  { label: 'Released', value: 'Released' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Needs Correction', value: 'Needs Correction' },
];

// ─── Details Modal ────────────────────────────────────────────────────────────

interface DetailsModalProps {
  request: DocumentRequest;
  onClose: () => void;
  onStatusChange: (status: DocumentStatus) => Promise<void>;
}

function DocumentDetailsModal({ request, onClose, onStatusChange }: DetailsModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleAction = async (status: DocumentStatus) => {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await onStatusChange(status);
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Failed to update status.';
      setErrorMessage(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const renderActionButtons = () => {
    switch (request.status) {
      case 'Pending Review':
        return (
          <>
            <button
              onClick={() => void handleAction('Under Review')}
              disabled={isUpdating}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Start Review
            </button>
            <button
              onClick={() => void handleAction('Rejected')}
              disabled={isUpdating}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Reject
            </button>
          </>
        );
      case 'Under Review':
        return (
          <>
            <button
              onClick={() => void handleAction('Payment Pending')}
              disabled={isUpdating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Request Payment
            </button>
            <button
              onClick={() => void handleAction('Needs Correction')}
              disabled={isUpdating}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Needs Correction
            </button>
            <button
              onClick={() => void handleAction('Rejected')}
              disabled={isUpdating}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Reject
            </button>
          </>
        );
      case 'Payment Pending':
        return (
          <>
            <button
              onClick={() => void handleAction('Payment Verified')}
              disabled={isUpdating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Verify Payment
            </button>
            <button
              onClick={() => void handleAction('Cancelled')}
              disabled={isUpdating}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Cancel
            </button>
          </>
        );
      case 'Payment Verified':
        return (
          <>
            <button
              onClick={() => void handleAction('Processing')}
              disabled={isUpdating}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Start Processing
            </button>
            <button
              onClick={() => void handleAction('Payment Pending')}
              disabled={isUpdating}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Reject Payment Proof
            </button>
          </>
        );
      case 'Processing':
        return (
          <button
            onClick={() => void handleAction('Ready for Pickup')}
            disabled={isUpdating}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
          >
            Mark Ready for Pickup
          </button>
        );
      case 'Ready for Pickup':
        return (
          <button
            onClick={() => void handleAction('Released')}
            disabled={isUpdating}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
          >
            Complete / Release
          </button>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 bg-[#7B1C2A] text-white">
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5 opacity-90" />
            <div>
              <h2 className="text-base font-bold tracking-wide">Request Details</h2>
              <p className="text-[10px] text-white/80 uppercase tracking-widest mt-0.5">{request.referenceNo}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800 animate-in fade-in duration-150">
            <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Applicant</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <User className="w-4 h-4 text-gray-400" />
                {request.applicantName} ({request.relationship})
              </div>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Requested Document</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <FileText className="w-4 h-4 text-gray-400" />
                {request.documentType}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Purpose</span>
              <p className="text-gray-800 mt-1 font-medium">{request.purpose || 'Official Requirement'}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Submission Date</span>
              <p className="text-gray-800 mt-1 font-medium">{request.dateSubmitted}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Payment Status</span>
              <p className="mt-1">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-semibold border",
                  request.paymentStatus === 'Paid' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                )}>
                  {request.paymentStatus || 'Pending'}
                </span>
              </p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Current Status</span>
              <p className="mt-1">
                <span className={cn(
                  "px-2 py-0.5 rounded-full text-xs font-semibold border",
                  request.status === 'Released' && "bg-blue-50 text-blue-700 border-blue-200",
                  request.status === 'Ready for Pickup' && "bg-green-50 text-green-700 border-green-200",
                  request.status === 'Processing' && "bg-purple-50 text-purple-700 border-purple-200",
                  (request.status === 'Pending Review' || request.status === 'Under Review') && "bg-amber-50 text-amber-700 border-amber-200",
                  (request.status === 'Rejected' || request.status === 'Needs Correction' || request.status === 'Cancelled') && "bg-red-50 text-red-700 border-red-200"
                )}>
                  {request.status}
                </span>
              </p>
            </div>
          </div>

          {/* Attachments Section */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Submitted Attachments</span>
            {request.attachments && request.attachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {request.attachments.map((file) => {
                  const fileUrl = `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/${file.r2ObjectKey}`;
                  return (
                    <div key={file.id} className="flex flex-col border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                      <span className="font-semibold text-xs text-gray-800 truncate" title={file.fileName}>{file.fileName}</span>
                      <span className="text-[10px] text-gray-400 mt-1">Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</span>
                      <span className="text-[10px] text-gray-400 capitalize">Category: {file.category}</span>
                      <div className="flex gap-2 mt-3">
                        <a
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-gray-800 text-[10px] font-bold rounded-md transition-all text-center flex-1"
                        >
                          Preview
                        </a>
                        <a
                          href={fileUrl}
                          download={file.fileName}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1 bg-[#7B1C2A] text-white hover:bg-[#9B2C3A] text-[10px] font-bold rounded-md transition-all text-center flex-1"
                        >
                          Download
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No supporting attachments uploaded.</p>
            )}
          </div>

          {/* Payments Section */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Payment Details</span>
            {request.paymentTransactions && request.paymentTransactions.length > 0 ? (
              <div className="space-y-4">
                {request.paymentTransactions.map((tx) => {
                  const receipt = tx.receipts?.[0];
                  const ocr = receipt?.ocrResult;
                  const receiptUrl = receipt ? `https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/${receipt.r2ObjectKey}` : null;
                  const needsManual = tx.status === 'PENDING' && (!ocr || !ocr.confidenceScore || ocr.confidenceScore < 0.9);

                  return (
                    <div key={tx.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-700 uppercase">Transaction</span>
                        <span className={cn(
                          "px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize",
                          tx.status === 'VERIFIED' && "bg-green-50 text-green-700 border-green-200",
                          tx.status === 'PENDING' && "bg-amber-50 text-amber-700 border-amber-200",
                          tx.status === 'REJECTED' && "bg-red-50 text-red-700 border-red-200"
                        )}>
                          {tx.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Provider</span>
                          <span className="font-semibold text-gray-800">{tx.provider || ocr?.provider || 'GCash'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Reference Number</span>
                          <span className="font-semibold text-gray-800">{tx.referenceNumber || ocr?.referenceNumber || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">Amount</span>
                          <span className="font-semibold text-gray-800">₱{tx.amount || ocr?.amount || '0.00'}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase">OCR Confidence</span>
                          <span className="font-semibold text-gray-800">
                            {ocr?.confidenceScore ? `${(ocr.confidenceScore * 100).toFixed(0)}%` : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {needsManual && (
                        <div className="flex items-center gap-2 p-2.5 bg-amber-50/60 border border-amber-200/50 rounded-lg text-xs text-amber-800">
                          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                          <span>Manual Review Required (OCR low confidence).</span>
                        </div>
                      )}

                      {receiptUrl && (
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase mb-1">Receipt Image Preview</span>
                          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-48 flex justify-center bg-gray-900">
                            <img
                              src={receiptUrl}
                              alt="Receipt Proof"
                              className="object-contain max-h-48"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic">No payment transactions recorded.</p>
            )}
          </div>

          {/* Timeline */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Request Timeline</span>
            <div className="relative border-l-2 border-gray-100 pl-4 ml-2 space-y-4">
              {request.timeline && request.timeline.length > 0 ? (
                request.timeline.map((t, idx) => (
                  <div key={idx} className="relative">
                    <span className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-crimson-700 border-2 border-white ring-4 ring-gray-50" />
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span className="font-semibold text-gray-800">{t.status}</span>
                      <span>{t.date}</span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>
                  </div>
                ))
              ) : (
                <div className="relative">
                  <span className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-crimson-700 border-2 border-white ring-4 ring-gray-50" />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">Pending Review</span>
                    <span>{request.dateSubmitted}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">Request received.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {renderActionButtons()}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border bg-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-700 text-white rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4">
      <Check className="w-4 h-4" />
      {message}
    </div>
  );
}

// ─── DocumentRequestsPage ─────────────────────────────────────────────────────

export function DocumentRequestsPage() {
  const location = useLocation();
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType | 'all'>('all');
  const [status, setStatus] = useState<DocumentStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 5;

  const fetchRequests = useCallback(async (silent = false) => {
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    try {
      const result = await getDocumentRequests({ search, documentType, status, page, pageSize: PAGE_SIZE });
      setRequests(result.data);
      setTotal(result.total);
      setTotalPages(result.totalPages);
    } catch (err: any) {
      console.error('Failed to load document requests:', err);
      if (!silent) {
        setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
      }
    } finally {
      if (!silent) {
        setIsLoading(false);
      }
    }
  }, [search, documentType, status, page]);

  useEffect(() => {
    void fetchRequests(false);
  }, [fetchRequests]);

  // Set up auto-refresh polling (every 60 seconds), paused when loading, or when a request details modal is active
  useAutoRefresh(
    () => void fetchRequests(true),
    { intervalMs: 60000, enabled: !isLoading && !selectedRequest }
  );

  // Listen to router state for auto-opening (e.g. from Notifications)
  useEffect(() => {
    if (location.state?.requestId && requests.length > 0) {
      const match = requests.find((r) => r.id === location.state.requestId);
      if (match) {
        setSelectedRequest(match);
      }
    }
  }, [location.state, requests]);

  const handleStatusUpdate = async (newStatus: DocumentStatus) => {
    if (!selectedRequest) return;
    try {
      await updateDocumentStatus(selectedRequest.id, newStatus);
      setToastMessage(`Request status updated to ${newStatus}.`);
      void fetchRequests(true);
    } catch (err) {
      console.error('Failed to update status:', err);
    }
  };

  // Reset page on filter change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleType = (v: string) => { setDocumentType(v as DocumentType | 'all'); setPage(1); };
  const handleStatus = (v: string) => { setStatus(v as DocumentStatus | 'all'); setPage(1); };

  return (
    <div>
      <PageHeader
        title="Document Requests"
        subtitle="Manage and process parishioner requests for official certificates and documents."
      />

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            placeholder="Search by Reference No. or Name..."
            value={search}
            onChange={handleSearch}
            className="flex-1"
          />
          <div className="flex gap-3">
            {/* Document Type filter */}
            <div className="relative">
              <select
                value={documentType}
                onChange={(e) => handleType(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[180px]"
                id="filter-document-type"
                aria-label="Filter by document type"
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => handleStatus(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[140px]"
                id="filter-status"
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading document requests..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchRequests(false)} />
        ) : (
          <>
            <DocumentRequestTable
              requests={requests}
              onViewDetails={setSelectedRequest}
            />
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              total={total}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      {/* Details Modal */}
      {selectedRequest && (
        <DocumentDetailsModal
          request={selectedRequest}
          onClose={() => setSelectedRequest(null)}
          onStatusChange={handleStatusUpdate}
        />
      )}

      {/* Toast Alert */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          onClose={() => setToastMessage(null)}
        />
      )}
    </div>
  );
}
