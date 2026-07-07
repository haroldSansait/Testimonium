import { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, X, Check, AlertCircle, FileText, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { DocumentRequestTable } from '@/components/document-requests/DocumentRequestTable';
import { getDocumentRequests, updateDocumentStatus } from '@/services/documentRequestService';
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

  const handleAction = async (status: DocumentStatus) => {
    setIsUpdating(true);
    try {
      await onStatusChange(status);
      onClose();
    } finally {
      setIsUpdating(false);
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

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {/* Main Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Applicant</span>
              <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                <User className="w-4 h-4 text-gray-400" />
                {request.parishionerName}
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
                  request.status === 'Pending Review' && "bg-amber-50 text-amber-700 border-amber-200",
                  (request.status === 'Rejected' || request.status === 'Needs Correction') && "bg-red-50 text-red-700 border-red-200"
                )}>
                  {request.status}
                </span>
              </p>
            </div>
          </div>

          {/* Requirements Checklist */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Submitted Requirements</span>
            <div className="mt-2 space-y-1.5">
              {(request.requirements || ['Government Issued ID', 'Parishioner Record Application']).map((reqItem, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 border border-gray-100 p-2.5 rounded-lg">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>{reqItem}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Request Timeline</span>
            <div className="relative border-l-2 border-gray-100 pl-4 ml-2 space-y-4">
              {(request.timeline || [
                { status: 'Pending Review', date: request.dateSubmitted, note: 'Request submitted and under review.' }
              ]).map((t, idx) => (
                <div key={idx} className="relative">
                  <span className="absolute -left-[23px] top-1 w-2.5 h-2.5 rounded-full bg-crimson-700 border-2 border-white ring-4 ring-gray-50" />
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span className="font-semibold text-gray-800">{t.status}</span>
                    <span>{t.date}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{t.note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleAction('Ready for Pickup')}
              disabled={isUpdating || request.status === 'Ready for Pickup' || request.status === 'Released'}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              <Check className="w-3.5 h-3.5" /> Approve
            </button>
            <button
              onClick={() => void handleAction('Needs Correction')}
              disabled={isUpdating || request.status === 'Released'}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              <AlertCircle className="w-3.5 h-3.5" /> Request Correction
            </button>
            <button
              onClick={() => void handleAction('Rejected')}
              disabled={isUpdating || request.status === 'Released'}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Reject
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors border"
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

  const PAGE_SIZE = 5;

  const fetchRequests = useCallback(async () => {
    const result = await getDocumentRequests({ search, documentType, status, page, pageSize: PAGE_SIZE });
    setRequests(result.data);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [search, documentType, status, page]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

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
      void fetchRequests();
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
