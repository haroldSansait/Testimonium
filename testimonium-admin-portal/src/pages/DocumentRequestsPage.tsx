import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X, Check, AlertCircle, FileText, User } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocumentRequestTable } from '@/components/document-requests/DocumentRequestTable';
import { getDocumentRequests, updateDocumentStatus } from '@/services/documentRequestService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import type { DocumentRequest, DocumentStatus, DocumentType } from '@/types';
import { cn } from '@/utils/cn';
import api from '@/api/api';

const mapFrontendToBackendDocType = (type: string): string => {
  switch (type) {
    case 'Baptismal Certificate':
      return 'BAPTISMAL_CERTIFICATE';
    case 'Marriage Certificate':
      return 'MARRIAGE_CERTIFICATE';
    case 'Confirmation Certificate':
      return 'CONFIRMATION_CERTIFICATE';
    case 'First Communion Certificate':
      return 'FIRST_COMMUNION_CERTIFICATE';
    case 'Good Moral Character':
      return 'GOOD_MORAL_CHARACTER';
    case 'Death Certificate':
      return 'DEATH_CERTIFICATE';
    default:
      return type;
  }
};

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
  { label: 'Under Review', value: 'Under Review' },
  { label: 'Payment Pending', value: 'Payment Pending' },
  { label: 'Awaiting Payment Review', value: 'Awaiting Payment Review' },
  { label: 'Payment Needs Correction', value: 'Payment Needs Correction' },
  { label: 'Payment Verified', value: 'Payment Verified' },
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
  onStatusChange: (status: DocumentStatus, remarks?: string, correctionRequirementIds?: string[]) => Promise<void>;
}

function DocumentDetailsModal({ request, onClose, onStatusChange }: DetailsModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [showPaymentCorrectionModal, setShowPaymentCorrectionModal] = useState(false);
  const [paymentCorrectionNotes, setPaymentCorrectionNotes] = useState('');
  const [requirements, setRequirements] = useState<{ id: string; label: string; description?: string }[]>([]);
  const [loadingReqs, setLoadingReqs] = useState(false);
  const [selectedReqs, setSelectedReqs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (showCorrectionModal) {
      setLoadingReqs(true);
      const backendType = mapFrontendToBackendDocType(request.documentType);
      api.get(`/document-requirements`, { params: { type: backendType, parishId: request.parishId } })
        .then(res => {
          const reqs = res.data?.data?.requiredDocuments || res.data?.requiredDocuments || [];
          setRequirements(reqs);
          const initialSelect: Record<string, boolean> = {};
          reqs.forEach((r: any) => {
            initialSelect[r.id] = false;
          });
          setSelectedReqs(initialSelect);
        })
        .catch(err => {
          console.error("Failed to fetch document requirements:", err);
        })
        .finally(() => {
          setLoadingReqs(false);
        });
    }
  }, [showCorrectionModal, request.documentType, request.parishId]);

  const handleAction = async (status: DocumentStatus, remarks?: string, correctionRequirementIds?: string[]) => {
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await onStatusChange(status, remarks, correctionRequirementIds);
      onClose();
    } catch (err: any) {
      console.error(err);
      const msg = err.response?.data?.message || err.message || 'Failed to update status.';
      setErrorMessage(msg);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleSendCorrection = async () => {
    if (!correctionNotes.trim()) {
      setErrorMessage('Please provide specific correction instructions for the parishioner.');
      return;
    }
    const selectedIds = Object.keys(selectedReqs).filter(id => selectedReqs[id]);
    if (selectedIds.length === 0) {
      setErrorMessage('Please select at least one document requirement that requires correction.');
      return;
    }
    await handleAction('Needs Correction', correctionNotes, selectedIds);
  };

  const handleSendPaymentCorrection = async () => {
    if (!paymentCorrectionNotes.trim()) {
      setErrorMessage('Please provide specific correction instructions for the payment proof.');
      return;
    }
    await handleAction('Payment Needs Correction', paymentCorrectionNotes);
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
              onClick={() => setShowCorrectionModal(true)}
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
      case 'Payment Needs Correction':
        return (
          <>
            <button
              onClick={() => void handleAction('Payment Verified')}
              disabled={isUpdating}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Verify Payment (Cash Override)
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
      case 'Awaiting Payment Review':
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
              onClick={() => setShowPaymentCorrectionModal(true)}
              disabled={isUpdating}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Reject Payment Proof
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
              onClick={() => setShowPaymentCorrectionModal(true)}
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

  return createPortal(
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

                  // Confidence display helpers
                  const confidence = ocr?.confidenceScore != null ? Math.round(ocr.confidenceScore * 100) : null;
                  const confidenceBadgeClass =
                    confidence == null ? 'bg-gray-100 text-gray-500 border-gray-200' :
                    confidence >= 80 ? 'bg-green-50 text-green-700 border-green-200' :
                    confidence >= 50 ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-red-50 text-red-700 border-red-200';
                  const confidenceLabel = confidence == null ? 'N/A' : `${confidence}%`;

                  const hasOcrData = ocr && (ocr.merchant || ocr.referenceNumber || ocr.amount || ocr.paymentDate);
                  const ocrProviderLabel = ocr?.ocrProvider
                    ? ocr.ocrProvider === 'ocrspace'
                      ? `OCR.space Engine ${ocr.ocrDurationMs != null ? `(${ocr.ocrDurationMs}ms)` : ''}`
                      : ocr.ocrProvider
                    : null;

                  const ocrStatus = ocr?.status || (ocr ? 'COMPLETED' : null);
                  const isOcrProcessing = ocrStatus === 'PENDING' || ocrStatus === 'PROCESSING';
                  const isOcrFailed = ocrStatus === 'FAILED';

                  const compRatio = ocr?.originalFileSize && ocr?.compressedFileSize
                    ? (ocr.originalFileSize / ocr.compressedFileSize).toFixed(1)
                    : null;
                  const originalSizeMb = ocr?.originalFileSize ? (ocr.originalFileSize / (1024 * 1024)).toFixed(2) : null;
                  const compressedSizeKb = ocr?.compressedFileSize ? (ocr.compressedFileSize / 1024).toFixed(0) : null;

                  return (
                    <div key={tx.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50 space-y-3">
                      {/* Transaction header */}
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

                      {/* OCR Summary Card */}
                      {/* OCR Summary Card */}
                      {isOcrProcessing ? (
                        <div className="border border-blue-100 rounded-lg bg-blue-50/30 p-3 space-y-2 animate-pulse">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">OCR Processing</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-blue-50 text-blue-700 border-blue-200">
                              PROCESSING
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            Receipt details are being extracted in the background. Please wait...
                          </p>
                        </div>
                      ) : isOcrFailed ? (
                        <div className="border border-red-100 rounded-lg bg-red-50/30 p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold text-red-700 uppercase tracking-widest">OCR Extraction Failed</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-red-50 text-red-700 border-red-200">
                              FAILED
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {ocr?.rawText || 'An error occurred during OCR extraction. Manual verification is required.'}
                          </p>
                        </div>
                      ) : hasOcrData ? (
                        <div className="border border-blue-100 rounded-lg bg-blue-50/30 p-3 space-y-2">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">OCR Summary</span>
                            <div className="flex items-center gap-2">
                              {ocrProviderLabel && (
                                <span className="text-[9px] text-gray-400">
                                  {ocrProviderLabel} {ocr?.ocrEngine ? `(Engine ${ocr.ocrEngine})` : ''}
                                </span>
                              )}
                              <span className={cn(
                                "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                                confidenceBadgeClass
                              )}>
                                Confidence: {confidenceLabel}
                              </span>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            {(ocr.merchant || tx.provider) && (
                              <div>
                                <span className="text-[10px] text-gray-400 block uppercase">Merchant</span>
                                <span className="font-semibold text-gray-800">{ocr.merchant || tx.provider}</span>
                              </div>
                            )}
                            {(ocr.referenceNumber || tx.referenceNumber) && (
                              <div>
                                <span className="text-[10px] text-gray-400 block uppercase">Reference No.</span>
                                <span className="font-semibold text-gray-800 font-mono tracking-wide">
                                  {ocr.referenceNumber || tx.referenceNumber}
                                </span>
                              </div>
                            )}
                            {(ocr.amount || tx.amount) && (
                              <div>
                                <span className="text-[10px] text-gray-400 block uppercase">Amount</span>
                                <span className="font-semibold text-gray-800">
                                  ₱{ocr.amount || tx.amount}
                                </span>
                              </div>
                            )}
                            {ocr.paymentDate && (
                              <div>
                                <span className="text-[10px] text-gray-400 block uppercase">Date</span>
                                <span className="font-semibold text-gray-800">{ocr.paymentDate}</span>
                              </div>
                            )}
                            {ocr.paymentTime && (
                              <div>
                                <span className="text-[10px] text-gray-400 block uppercase">Time</span>
                                <span className="font-semibold text-gray-800">{ocr.paymentTime}</span>
                              </div>
                            )}
                            {ocr.accountName && (
                              <div className="col-span-2">
                                <span className="text-[10px] text-gray-400 block uppercase">Account Name</span>
                                <span className="font-semibold text-gray-800">{ocr.accountName}</span>
                              </div>
                            )}
                          </div>

                          {/* Observability Details Grid */}
                          <div className="mt-2 border-t border-blue-100/50 pt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[9px] text-gray-400 font-mono">
                            {ocr.parserConfidence != null && (
                              <div>
                                <span>Parser Conf: </span>
                                <span className="font-semibold text-gray-600">{(ocr.parserConfidence * 100).toFixed(0)}%</span>
                              </div>
                            )}
                            {ocr.ocrConfidence != null && (
                              <div>
                                <span>OCR Engine Conf: </span>
                                <span className="font-semibold text-gray-600">{(ocr.ocrConfidence * 100).toFixed(0)}%</span>
                              </div>
                            )}
                            {ocr.ocrDurationMs != null && (
                              <div>
                                <span>OCR Speed: </span>
                                <span className="font-semibold text-gray-600">{ocr.ocrDurationMs}ms</span>
                              </div>
                            )}
                            {compRatio && (
                              <div>
                                <span>Ratio: </span>
                                <span className="font-semibold text-gray-600">{compRatio}x ({originalSizeMb}MB → {compressedSizeKb}KB)</span>
                              </div>
                            )}
                          </div>

                          {/* Collapsible raw text viewer */}
                          {ocr.rawText && (
                            <div className="mt-2 pt-1 border-t border-blue-100/50">
                              <details className="text-[10px]">
                                <summary className="cursor-pointer font-semibold text-blue-600 hover:text-blue-800 select-none">
                                  View Raw OCR Text
                                </summary>
                                <pre className="mt-1.5 p-2 bg-gray-900 text-gray-100 text-[9px] rounded font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto read-only select-text">
                                  {ocr.rawText}
                                </pre>
                              </details>
                            </div>
                          )}

                          {/* Manual review notice — always shown regardless of confidence */}
                          <div className="flex items-center gap-2 mt-1 p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg text-xs text-amber-800">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                            <span className="text-[10px]">Manual review required. OCR assists verification — secretary approval is always mandatory.</span>
                          </div>
                        </div>
                      ) : (
                        <div className="border border-gray-100 rounded-lg p-3 bg-white/60 space-y-1">
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <AlertCircle className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                            <span className="text-[10px]">
                              {ocr
                                ? 'OCR could not extract receipt data. Manual verification required.'
                                : 'No OCR data available for this receipt.'}
                            </span>
                          </div>
                          {/* Still show manually entered transaction data if available */}
                          {(tx.provider || tx.referenceNumber || tx.amount) && (
                            <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                              {tx.provider && (
                                <div>
                                  <span className="text-[10px] text-gray-400 block uppercase">Provider</span>
                                  <span className="font-semibold text-gray-800">{tx.provider}</span>
                                </div>
                              )}
                              {tx.referenceNumber && (
                                <div>
                                  <span className="text-[10px] text-gray-400 block uppercase">Reference</span>
                                  <span className="font-semibold text-gray-800">{tx.referenceNumber}</span>
                                </div>
                              )}
                              {tx.amount && (
                                <div>
                                  <span className="text-[10px] text-gray-400 block uppercase">Amount</span>
                                  <span className="font-semibold text-gray-800">₱{tx.amount}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Original receipt image — secretary always sees full quality */}
                      {receiptUrl && (
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase mb-1">Receipt Image (Original Quality)</span>
                          <div className="border border-gray-200 rounded-lg overflow-hidden max-h-56 flex justify-center bg-gray-900">
                            <img
                              src={receiptUrl}
                              alt="Receipt Proof"
                              className="object-contain max-h-56"
                            />
                          </div>
                          <a
                            href={receiptUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-1.5 inline-block text-[10px] text-blue-600 hover:underline"
                          >
                            Open full-size image ↗
                          </a>
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

        {/* Correction Instructions Sub-Modal */}
        {showCorrectionModal && (
          <div className="absolute inset-0 bg-white z-20 p-6 flex flex-col justify-between overflow-y-auto animate-in fade-in duration-150">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-gray-900">Request Document Correction</h3>
                <button onClick={() => setShowCorrectionModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Specify what needs to be corrected by the parishioner (e.g. illegible ID scan, missing GKK signature, incorrect registrant name).
              </p>
              <textarea
                value={correctionNotes}
                onChange={(e) => setCorrectionNotes(e.target.value)}
                placeholder="Enter detailed correction notes and instructions for the parishioner..."
                rows={4}
                className="w-full p-3 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:border-[#7B1C2A] focus:ring-1 focus:ring-[#7B1C2A]"
              />

              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Select requirements requiring correction</span>
                {loadingReqs ? (
                  <p className="text-xs text-gray-400">Loading requirements...</p>
                ) : requirements.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">No requirement definitions configured for this document type.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto border border-gray-150 rounded-xl p-3 bg-gray-50/50">
                    {requirements.map((req) => (
                      <label key={req.id} className="flex items-start gap-2.5 p-1.5 hover:bg-white rounded-lg cursor-pointer transition-colors text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!selectedReqs[req.id]}
                          onChange={(e) => setSelectedReqs(prev => ({ ...prev, [req.id]: e.target.checked }))}
                          className="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                        />
                        <div>
                          <span className="font-semibold block">{req.label}</span>
                          {req.description && <span className="text-[10px] text-gray-400">{req.description}</span>}
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="px-4 py-2 text-xs font-semibold border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSendCorrection()}
                disabled={isUpdating || !correctionNotes.trim() || Object.keys(selectedReqs).filter(id => selectedReqs[id]).length === 0}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40"
              >
                Send Correction Request
              </button>
            </div>
          </div>
        )}

        {showPaymentCorrectionModal && (
          <div className="absolute inset-0 bg-white z-20 p-6 flex flex-col justify-between overflow-y-auto animate-in fade-in duration-150">
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <h3 className="text-base font-bold text-gray-900">Reject Payment Proof</h3>
                <button onClick={() => setShowPaymentCorrectionModal(false)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Specify what needs to be corrected in the uploaded payment proof (e.g. blurry receipt image, incorrect amount paid, duplicate reference number).
              </p>
              <textarea
                value={paymentCorrectionNotes}
                onChange={(e) => setPaymentCorrectionNotes(e.target.value)}
                placeholder="Enter detailed correction notes and instructions for the payment proof..."
                rows={5}
                className="w-full p-3 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:border-[#7B1C2A] focus:ring-1 focus:ring-[#7B1C2A]"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 flex-shrink-0">
              <button
                onClick={() => setShowPaymentCorrectionModal(false)}
                className="px-4 py-2 text-xs font-semibold border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleSendPaymentCorrection()}
                disabled={isUpdating || !paymentCorrectionNotes.trim()}
                className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-40"
              >
                Send Correction Request
              </button>
            </div>
          </div>
        )}

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
    </div>,
    document.body
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
  const [isMutating, setIsMutating] = useState(false);

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

  // Set up auto-refresh polling (every 60 seconds), paused when loading, when modal is active, or when mutating
  useAutoRefresh(
    () => void fetchRequests(true),
    { intervalMs: 60000, enabled: !isLoading && !selectedRequest && !isMutating }
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

  const handleStatusUpdate = async (newStatus: DocumentStatus, remarks?: string, correctionRequirementIds?: string[]) => {
    if (!selectedRequest) return;
    setIsMutating(true);
    const originalRequest = { ...selectedRequest };
    const originalRequests = [...requests];

    // Optimistic UI updates
    setRequests(prev => prev.map(r => r.id === selectedRequest.id ? { ...r, status: newStatus } : r));
    setSelectedRequest(prev => prev ? { ...prev, status: newStatus } : null);

    try {
      await updateDocumentStatus(selectedRequest.id, newStatus, remarks, correctionRequirementIds);
      setToastMessage(`Request status updated to ${newStatus}.`);
    } catch (err: any) {
      console.error('Failed to update status:', err);
      // Rollback on error
      setRequests(originalRequests);
      setSelectedRequest(originalRequest);
      setToastMessage(`Error: ${err.message || 'Failed to update status.'}`);
    } finally {
      setIsMutating(false);
      void fetchRequests(true);
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
            <div className="w-[195px]">
              <CustomSelect
                value={documentType}
                onChange={handleType}
                options={DOCUMENT_TYPE_OPTIONS}
                placeholder="All Document Types"
                id="filter-document-type"
                aria-label="Filter by document type"
              />
            </div>

            {/* Status filter */}
            <div className="w-[160px]">
              <CustomSelect
                value={status}
                onChange={handleStatus}
                options={STATUS_OPTIONS}
                placeholder="All Statuses"
                id="filter-status"
                aria-label="Filter by status"
              />
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
