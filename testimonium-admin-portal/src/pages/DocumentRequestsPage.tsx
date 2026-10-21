import { useCachedQuery } from '@/hooks/useCachedQuery';
import type { SetStateAction } from 'react';
import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { X, Check, AlertCircle, FileText, User, RefreshCw, ShieldCheck } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { DocumentRequestTable } from '@/components/document-requests/DocumentRequestTable';
import { SecureBlobViewer } from '@/components/document-requests/SecureBlobViewer';
import { getDocumentRequests, updateDocumentStatus, uploadCorrectedDocument } from '@/services/documentRequestService';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { useAutoRefresh } from '@/hooks/useAutoRefresh';
import { DOCUMENT_RETURN_REASONS, type DocumentRequest, type DocumentStatus, type DocumentType } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { canManageDocumentRequests } from '@/permissions/rolePermissions';
import { cn } from '@/utils/cn';
import api from '@/api/api';
import {
  DOCUMENT_TYPE_FILTER_OPTIONS,
  getDocumentRequirementsLookupParams,
} from '@/config/documents';

const DOCUMENT_TYPE_OPTIONS: { label: string; value: DocumentType | 'all' }[] = [
  { label: 'All Document Types', value: 'all' },
  ...DOCUMENT_TYPE_FILTER_OPTIONS,
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
  { label: 'Ready for Signing', value: 'Ready for Signing' },
  { label: 'Ready for Pickup', value: 'Ready for Pickup' },
  { label: 'Released', value: 'Released' },
  { label: 'Returned for Correction', value: 'Returned for Correction' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Needs Correction', value: 'Needs Correction' },
];

interface RegistrantIdEvidenceDetail {
  applicantName: string;
  relationship: string | null;
  front: { available: boolean; uploadedAt?: string | null; mimeType?: string | null; size?: number | null };
  back: { available: boolean; uploadedAt?: string | null; mimeType?: string | null; size?: number | null };
  ocrStatus: string;
  ocrErrorCode?: string | null;
  extractedName?: string | null;
  detectedIdType?: string | null;
  idNumber?: string | null;
  dateOfBirth?: string | null;
  expiryDate?: string | null;
  frontText?: string | null;
  backText?: string | null;
  advisoryFlags: string[];
  processedAt?: string | null;
  label: string;
}

export const CANONICAL_CORRECTION_REASONS = [
  { code: 'UNCLEAR_OR_BLURRY', label: 'Unclear / blurry / unreadable document' },
  { code: 'WRONG_DOCUMENT', label: 'Wrong document uploaded' },
  { code: 'INCOMPLETE_DOCUMENT', label: 'Incomplete document / missing page or side' },
  { code: 'CROPPED_INFORMATION', label: 'Cropped document / important information not visible' },
  { code: 'APPLICANT_MISMATCH', label: 'Information does not match applicant/request' },
  { code: 'EXPIRED_OR_INVALID', label: 'Expired / invalid document' },
  { code: 'INCORRECT_REQUIREMENT_FILE', label: 'Incorrect file uploaded for this requirement' },
  { code: 'OTHER', label: 'Other' },
];

// ─── Details Modal ────────────────────────────────────────────────────────────

interface DetailsModalProps {
  request: DocumentRequest;
  onClose: () => void;
  onStatusChange: (
    status: DocumentStatus,
    remarks?: string,
    correctionRequirementIds?: string[],
    correctionReasonCode?: string,
    correctionNote?: string
  ) => Promise<void>;
  onRefetchRequest?: () => Promise<void>;
  canManage?: boolean;
}

function DocumentDetailsModal({ request, onClose, onStatusChange, onRefetchRequest, canManage = true }: DetailsModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionReasonCode, setCorrectionReasonCode] = useState('');
  const [correctionNotes, setCorrectionNotes] = useState('');
  const [correctionModalError, setCorrectionModalError] = useState<string | null>(null);
  const [showPaymentCorrectionModal, setShowPaymentCorrectionModal] = useState(false);
  const [paymentCorrectionNotes, setPaymentCorrectionNotes] = useState('');
  const [requirements, setRequirements] = useState<{ id: string; label: string; description?: string }[]>([]);
  const [requirementsLoadState, setRequirementsLoadState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [selectedReqs, setSelectedReqs] = useState<Record<string, boolean>>({});
  const [registrantEvidence, setRegistrantEvidence] = useState<RegistrantIdEvidenceDetail | null>(null);
  const [registrantEvidenceState, setRegistrantEvidenceState] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const updateInFlightRef = useRef(false);
  const [correctedFile, setCorrectedFile] = useState<File | null>(null);
  const [isUploadingCorrected, setIsUploadingCorrected] = useState(false);
  const [correctedUploadError, setCorrectedUploadError] = useState<string | null>(null);
  const [correctedUploadSuccess, setCorrectedUploadSuccess] = useState<string | null>(null);
  const correctedUploadInFlightRef = useRef(false);

  const activeReturn = request.returns && request.returns.length > 0
    ? request.returns[request.returns.length - 1]
    : null;
  const hasActiveCorrectedUpload = Boolean(activeReturn?.correctedFileName);

  const handleUploadCorrected = async () => {
    if (!canManage || !correctedFile || correctedUploadInFlightRef.current || hasActiveCorrectedUpload) return;
    correctedUploadInFlightRef.current = true;
    setIsUploadingCorrected(true);
    setCorrectedUploadError(null);
    setCorrectedUploadSuccess(null);
    try {
      await uploadCorrectedDocument(request.id, correctedFile);
      setCorrectedUploadSuccess('Corrected document uploaded successfully.');
      setCorrectedFile(null);
      if (onRefetchRequest) {
        await onRefetchRequest();
      }
    } catch (err: any) {
      const isConflict = err.response?.status === 409 || err.response?.data?.code === 'CORRECTED_DOCUMENT_ALREADY_UPLOADED';
      if (isConflict && onRefetchRequest) {
        try {
          await onRefetchRequest();
        } catch {
          setCorrectedUploadError('Another staff member already uploaded the corrected document. Close and reopen this request to load the current file.');
          return;
        }
      }
      setCorrectedUploadError(
        isConflict
          ? 'Another staff member already uploaded the corrected document. The latest cycle has been reloaded.'
          : err.response?.data?.message || err.message || 'Failed to upload corrected document.'
      );
    } finally {
      correctedUploadInFlightRef.current = false;
      setIsUploadingCorrected(false);
    }
  };
  const loadingReqs = requirementsLoadState === 'loading';

  const loadRequirements = useCallback(async () => {
    setRequirementsLoadState('loading');
    setCorrectionModalError(null);
    setRequirements([]);
    setSelectedReqs({});
    const params = { ...getDocumentRequirementsLookupParams(request.documentType, request.parishId), relationship: request.relationship || 'Self' };
    try {
      const res = await api.get(`/document-requirements`, { params });
      const authoritativeReqs = res.data?.data?.requiredDocuments || res.data?.requiredDocuments || [];
      const relationshipReqs = res.data?.data?.relationshipEvidence || res.data?.relationshipEvidence || [];
      const correctionEligibleReqs = [...authoritativeReqs, ...relationshipReqs].filter((r: { id: string }) => r.id !== 'valid_id');
      setRequirements(correctionEligibleReqs);
      const initialSelect: Record<string, boolean> = {};
      correctionEligibleReqs.forEach((r: { id: string }) => {
        initialSelect[r.id] = false;
      });
      setSelectedReqs(initialSelect);
      setRequirementsLoadState('success');
    } catch (err) {
      console.error("Failed to fetch document requirements:", err);
      setRequirementsLoadState('error');
      setCorrectionModalError("Unable to determine correctable requirements. Retry.");
    }
  }, [request.documentType, request.parishId, request.relationship]);

  useEffect(() => {
    let cancelled = false;
    setRegistrantEvidence(null);
    if (!canManage || request.relationship === 'Self') {
      setRegistrantEvidenceState('idle');
      return () => { cancelled = true; };
    }
    setRegistrantEvidenceState('loading');
    api.get(`/document-requests/${request.id}/registrant-id`)
      .then((response) => {
        if (cancelled) return;
        setRegistrantEvidence(response.data?.data || null);
        setRegistrantEvidenceState('success');
      })
      .catch(() => {
        if (!cancelled) setRegistrantEvidenceState('error');
      });
    return () => { cancelled = true; };
  }, [canManage, request.id, request.relationship]);

  useEffect(() => {
    if (canManage && request.status === 'Under Review') {
      void loadRequirements();
    }
  }, [canManage, request.status, loadRequirements]);

  const handleAction = async (
    status: DocumentStatus,
    remarks?: string,
    correctionRequirementIds?: string[],
    correctionReasonCode?: string,
    correctionNote?: string
  ) => {
    if (!canManage || updateInFlightRef.current) return;
    updateInFlightRef.current = true;
    setIsUpdating(true);
    setErrorMessage(null);
    try {
      await onStatusChange(status, remarks, correctionRequirementIds, correctionReasonCode, correctionNote);
      onClose();
    } catch (err: any) {
      console.error(err);
      const is409 = err.response?.status === 409 || err.code === 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT' || err.response?.data?.code === 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT';
      if (is409) {
        setErrorMessage('Another staff member has already modified this request. The latest request state has been reloaded. Please review the updated request before submitting again.');
        if (onRefetchRequest) {
          try {
            await onRefetchRequest();
          } catch {
            setErrorMessage('Another staff member modified this request, and the latest state could not be reloaded. Close and reopen the request before trying again.');
          }
        }
      } else {
        const msg = err.response?.data?.message || err.message || 'Failed to update status.';
        setErrorMessage(msg);
      }
    } finally {
      updateInFlightRef.current = false;
      setIsUpdating(false);
    }
  };

  const handleSendCorrection = async () => {
    if (!canManage || updateInFlightRef.current) return;
    if (!correctionReasonCode) {
      setCorrectionModalError('Please select a reason for rejection.');
      return;
    }
    const selectedIds = requirements.filter(req => selectedReqs[req.id]).map(req => req.id);
    if (selectedIds.length === 0) {
      setCorrectionModalError('Please select at least one affected document requirement.');
      return;
    }
    if (correctionNotes && correctionNotes.trim().length > 1000) {
      setCorrectionModalError('Additional note must not exceed 1000 characters.');
      return;
    }

    updateInFlightRef.current = true;
    setIsUpdating(true);
    setCorrectionModalError(null);
    try {
      await onStatusChange(
        'Needs Correction',
        undefined,
        selectedIds,
        correctionReasonCode,
        correctionNotes.trim() || undefined
      );
      setShowCorrectionModal(false);
      onClose();
    } catch (err: any) {
      console.error('Correction submission error:', err);
      const is409 = err.response?.status === 409 || err.code === 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT' || err.response?.data?.code === 'DOCUMENT_REQUEST_CONCURRENCY_CONFLICT';
      if (is409) {
        setCorrectionModalError('Another staff member has already modified this request. The latest request state has been reloaded. Please review the updated request before submitting again.');
        if (onRefetchRequest) {
          try {
            await onRefetchRequest();
          } catch {
            setCorrectionModalError('Another staff member modified this request, and the latest state could not be reloaded. Close and reopen the request before trying again.');
          }
        }
      } else {
        const msg = err.response?.data?.message || err.message || 'Failed to submit correction.';
        setCorrectionModalError(msg);
      }
    } finally {
      updateInFlightRef.current = false;
      setIsUpdating(false);
    }
  };

  const handleSendPaymentCorrection = async () => {
    if (!canManage) return;
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
          <button
            onClick={() => void handleAction('Under Review')}
            disabled={isUpdating}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
          >
            Start Review
          </button>
        );
      case 'Under Review':
        return (
          <div className="flex flex-col items-start gap-1.5">
            <div className="flex items-center gap-2">
              <button
                onClick={() => void handleAction('Payment Pending')}
                disabled={isUpdating}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
              >
                Request Payment
              </button>
              <button
                onClick={() => {
                  if (requirementsLoadState !== 'success' || requirements.length === 0) return;
                  setCorrectionModalError(null);
                  setShowCorrectionModal(true);
                }}
                disabled={
                  isUpdating ||
                  requirementsLoadState !== 'success' ||
                  requirements.length === 0
                }
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
              >
                Reject
              </button>
            </div>
            {(requirementsLoadState === 'idle' || requirementsLoadState === 'loading') && (
              <p className="text-[11px] text-gray-500">Checking correctable requirements...</p>
            )}
            {requirementsLoadState === 'error' && (
              <p className="text-[11px] text-red-700">
                Unable to determine correctable requirements.{' '}
                <button
                  type="button"
                  onClick={() => void loadRequirements()}
                  className="font-semibold underline hover:no-underline"
                >
                  Retry
                </button>
              </p>
            )}
            {requirementsLoadState === 'success' && requirements.length === 0 && (
              <p className="text-[11px] text-gray-500">
                This request has no supporting documents that can be returned for correction.
              </p>
            )}
          </div>
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
            onClick={() => void handleAction('Ready for Signing')}
            disabled={isUpdating}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
          >
            Mark Ready for Signing
          </button>
        );
      case 'Ready for Signing':
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
      case 'Returned for Correction':
        return (
          <div className="flex items-center gap-2">
            <button
              onClick={() => void handleAction('Ready for Pickup')}
              disabled={isUpdating || !hasActiveCorrectedUpload}
              title={!hasActiveCorrectedUpload ? 'Upload the corrected document before marking ready for pickup' : undefined}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
            >
              Mark Ready for Pickup
            </button>
            {!hasActiveCorrectedUpload && (
              <span className="text-[11px] text-amber-700 font-medium">
                Upload corrected document above to proceed
              </span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !isUpdating && onClose()}
    >
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
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
            disabled={isUpdating}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors disabled:opacity-40"
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
          <div className="bg-gray-50/70 border border-gray-200/80 rounded-xl p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Requester (Parishioner Account)</span>
                <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="truncate">{request.parishionerName || 'Parishioner'}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Registrant (Record Holder)</span>
                <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                  <User className="w-4 h-4 text-[#7B1C2A] flex-shrink-0" />
                  <span className="font-semibold text-gray-900 truncate">{request.applicantName || request.parishionerName}</span>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-[10px] font-bold border ml-auto flex-shrink-0",
                    request.relationship === 'Self'
                      ? "bg-green-50 text-green-700 border-green-200"
                      : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {request.relationship === 'Self' ? 'Self' : `Rep: ${request.relationship}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2.5 border-t border-gray-200/60">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Requested Document</span>
                <div className="flex items-center gap-2 text-gray-800 mt-1 font-medium">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span>{request.documentType}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Purpose</span>
                <p className="text-gray-800 mt-1 font-medium">{request.purpose || 'Official Requirement'}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2.5 border-t border-gray-200/60">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Submission Date</span>
                <p className="text-gray-800 mt-1 font-medium text-xs">{request.dateSubmitted}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Payment Status</span>
                <p className="mt-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-semibold border",
                    request.paymentStatus === 'Paid' ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {request.paymentStatus || 'Pending'}
                  </span>
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Current Status</span>
                <p className="mt-1">
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-xs font-semibold border",
                    request.status === 'Released' && "bg-blue-50 text-blue-700 border-blue-200",
                    request.status === 'Returned for Correction' && "bg-amber-50 text-amber-800 border-amber-300",
                    request.status === 'Ready for Pickup' && "bg-green-50 text-green-700 border-green-200",
                    request.status === 'Ready for Signing' && "bg-indigo-50 text-indigo-700 border-indigo-200",
                    request.status === 'Processing' && "bg-purple-50 text-purple-700 border-purple-200",
                    (request.status === 'Pending Review' || request.status === 'Under Review') && "bg-amber-50 text-amber-700 border-amber-200",
                    (request.status === 'Rejected' || request.status === 'Needs Correction' || request.status === 'Cancelled') && "bg-red-50 text-red-700 border-red-200"
                  )}>
                    {request.status}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Self Relationship Verification Callout */}
          {request.relationship === 'Self' && (
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-start gap-2.5 text-xs text-emerald-900">
              <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block text-emerald-950">Identity Verified via Account Profile</span>
                <span className="text-[11px] text-emerald-800 leading-relaxed">
                  The parishioner requested their own sacramental record. Identity verification is satisfied by their verified diocesan Government ID. No separate registrant ID images or signed authorization letter are required.
                </span>
              </div>
            </div>
          )}

          {/* Post-Release Document Return Workflow Section */}
          {(request.status === 'Returned for Correction' || (request.returns && request.returns.length > 0)) && (
            <div className="p-4 bg-amber-50/70 border border-amber-200/80 rounded-xl space-y-3.5 text-xs text-amber-950">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                  <span className="font-bold text-sm text-amber-900">
                    Post-Release Document Return {request.status === 'Returned for Correction' ? '(Active Return Cycle)' : '(Resolved)'}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full uppercase tracking-wider">
                  100% Free Correction
                </span>
              </div>

              {activeReturn && (
                <div className="bg-white/80 border border-amber-200/60 rounded-xl p-3.5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Return Cycle</span>
                      <p className="font-semibold text-gray-800 mt-0.5">Cycle #{activeReturn.cycleNumber}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Defect Reason</span>
                      <p className="font-semibold text-amber-900 mt-0.5">
                        {DOCUMENT_RETURN_REASONS.find(r => r.code === activeReturn.reasonCode)?.label || activeReturn.reasonCode}
                      </p>
                    </div>
                  </div>

                  {activeReturn.notes && (
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Parishioner Note</span>
                      <p className="text-gray-700 bg-gray-50 border border-gray-150 p-2.5 rounded-lg mt-1 text-xs">
                        {activeReturn.notes}
                      </p>
                    </div>
                  )}

                  {/* Defective Document Evidence Viewer */}
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                      Parishioner-Submitted Defective Document
                    </span>
                    <SecureBlobViewer
                      endpoint={`/document-requests/${request.id}/returns/${activeReturn.id}/file/returned`}
                      fileName={activeReturn.returnedFileName}
                      mimeType={activeReturn.returnedFileType}
                      alt="Defective document scan/photo"
                      compact
                    />
                  </div>

                  {/* Corrected Document Upload Status / Form */}
                  <div className="pt-3 border-t border-amber-100 space-y-2">
                    <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest block">
                      Corrected Replacement Document (Issued Copy)
                    </span>

                    {activeReturn.correctedFileName ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg">
                          <span className="font-semibold">✓ Corrected document on file: {activeReturn.correctedFileName}</span>
                          <span className="text-[10px] text-gray-400">
                            {activeReturn.correctedAt ? new Date(activeReturn.correctedAt).toLocaleString() : ''}
                          </span>
                        </div>
                        <SecureBlobViewer
                          endpoint={`/document-requests/${request.id}/returns/${activeReturn.id}/file/corrected`}
                          fileName={activeReturn.correctedFileName}
                          mimeType={activeReturn.correctedFileType}
                          alt="Corrected document copy"
                          compact
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-amber-800 bg-amber-100/50 p-2 rounded-lg border border-amber-200">
                        A corrected document must be uploaded before this request can be marked Ready for Pickup.
                      </p>
                    )}

                    {canManage && request.status === 'Returned for Correction' && !hasActiveCorrectedUpload && (
                      <div className="mt-2 space-y-2">
                        {correctedUploadError && (
                          <p className="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200">
                            {correctedUploadError}
                          </p>
                        )}
                        {correctedUploadSuccess && (
                          <p className="text-xs text-green-700 bg-green-50 p-2 rounded border border-green-200">
                            {correctedUploadSuccess}
                          </p>
                        )}
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept=".pdf,image/png,image/jpeg,image/webp"
                            onChange={(e) => {
                              if (e.target.files && e.target.files[0]) {
                                setCorrectedFile(e.target.files[0]);
                                setCorrectedUploadError(null);
                                setCorrectedUploadSuccess(null);
                              }
                            }}
                            disabled={isUploadingCorrected}
                            className="text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => void handleUploadCorrected()}
                            disabled={!correctedFile || isUploadingCorrected}
                            className="px-3 py-1.5 bg-[#7B1C2A] hover:bg-[#601520] text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors flex-shrink-0"
                          >
                            {isUploadingCorrected ? 'Uploading...' : 'Upload Corrected Document'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Multi-cycle History */}
              {request.returns && request.returns.length > 1 && (
                <div className="pt-2 border-t border-amber-200/60 space-y-2">
                  <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest block">
                    Earlier Return Cycles
                  </span>
                  <div className="space-y-1.5">
                    {request.returns.slice(0, -1).map((ret) => (
                      <div key={ret.id} className="bg-white/60 border border-gray-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-gray-700">
                        <div>
                          <span className="font-semibold">Cycle #{ret.cycleNumber}:</span>{' '}
                          <span>{DOCUMENT_RETURN_REASONS.find(r => r.code === ret.reasonCode)?.label || ret.reasonCode}</span>
                          <span className="text-gray-400 block text-[10px]">
                            Returned: {new Date(ret.returnedAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex gap-2 text-[10px]">
                          <SecureBlobViewer
                            endpoint={`/document-requests/${request.id}/returns/${ret.id}/file/returned`}
                            fileName={ret.returnedFileName}
                            mimeType={ret.returnedFileType}
                            alt="Prior defective document"
                            compact
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Attachments Section */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Submitted Attachments</span>
            {request.attachments && request.attachments.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {request.attachments.map((file) => {
                  return (
                    <div key={file.id} className="flex flex-col border border-gray-200 rounded-xl p-3 bg-gray-50/50">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-xs text-gray-800 truncate" title={file.fileName}>{file.fileName}</span>
                        {file.category === 'authorization_letter' ? (
                          <span className="text-[9px] font-bold text-red-800 bg-red-100 px-2 py-0.5 rounded-full flex-shrink-0 uppercase tracking-wider">
                            Authorization Letter
                          </span>
                        ) : (
                          <span className="text-[9px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded capitalize flex-shrink-0">{file.category}</span>
                        )}
                      </div>
                      <span className="text-[10px] text-gray-400 mt-1">Uploaded: {new Date(file.uploadedAt).toLocaleDateString()}</span>
                      <div className="mt-3">
                        <SecureBlobViewer
                          endpoint={`/document-requests/${request.id}/attachments/${file.id}/download`}
                          fileName={file.fileName}
                          mimeType={file.fileType}
                          alt={`Secure preview of ${file.fileName}`}
                          compact
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-gray-400 italic bg-gray-50/50 p-3 rounded-xl border border-gray-100">No supporting attachments uploaded.</p>
            )}
          </div>

          {request.relationship !== 'Self' && canManage ? (
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Registrant Government ID Evidence &amp; Advisory OCR</span>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  Submitted evidence for the sacramental record holder, separate from the requester's profile Government ID.
                </p>
              </div>
              {registrantEvidenceState === 'loading' ? (
                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl flex items-center gap-2.5 text-xs text-gray-500">
                  <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />
                  <span>Loading secure registrant evidence...</span>
                </div>
              ) : registrantEvidenceState === 'error' ? (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl p-3">Registrant ID details could not be loaded. Refresh your session and try again.</p>
              ) : !registrantEvidence ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">No registrant ID evidence on file - request submitted before this requirement.</p>
              ) : (
                <div className="border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-4">
                  {/* Uploaded ID Images */}
                  <div>
                    <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block mb-2">Uploaded Physical ID Images</span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {(['front', 'back'] as const).map((side) => {
                        const metadata = registrantEvidence[side];
                        return (
                          <div key={side} className="border border-gray-200 bg-white rounded-lg p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-gray-800 capitalize">{side} Image</span>
                              {metadata.available && (
                                <span className="text-[9px] font-bold text-green-700 bg-green-50 border border-green-200 px-1.5 py-0.5 rounded">
                                  Available
                                </span>
                              )}
                            </div>
                            {metadata.available ? (
                              <SecureBlobViewer
                                endpoint={`/document-requests/${request.id}/registrant-id/${side}`}
                                fileName={`registrant-id-${side}.${metadata.mimeType === 'image/png' ? 'png' : 'jpg'}`}
                                mimeType={metadata.mimeType}
                                alt={`Registrant Government ID ${side}`}
                              />
                            ) : (
                              <p className="text-xs text-red-600 bg-red-50 p-2 rounded border border-red-100">Missing {side} image.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Advisory OCR Extraction */}
                  <div className="border border-blue-200 rounded-xl bg-blue-50/40 p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-blue-100">
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-blue-700" />
                        <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider">
                          Advisory OCR Extraction — Automated Assist (Not Verified Identity)
                        </span>
                      </div>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        registrantEvidence.ocrStatus === 'COMPLETED' ? "bg-blue-100 text-blue-800 border-blue-300" :
                        registrantEvidence.ocrStatus === 'FAILED' ? "bg-red-50 text-red-700 border-red-200" :
                        "bg-white text-blue-700 border-blue-200"
                      )}>
                        {registrantEvidence.ocrStatus}
                      </span>
                    </div>

                    {['FAILED', 'UNAVAILABLE'].includes(registrantEvidence.ocrStatus) ? (
                      <p className="text-xs text-amber-800 bg-amber-50/80 p-2 rounded-lg border border-amber-200">
                        OCR unavailable - review the images manually.
                      </p>
                    ) : null}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs bg-white/70 p-3 rounded-lg border border-blue-100/70">
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-medium">Requested Registrant</span>
                        <span className="font-semibold text-gray-900">{request.applicantName || registrantEvidence.applicantName}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-medium">Extracted Name</span>
                        <span className="font-semibold text-gray-900">{registrantEvidence.extractedName || 'Not extracted'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-medium">Detected ID Type</span>
                        <span className="text-gray-800">{registrantEvidence.detectedIdType || 'Not extracted'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-medium">ID / Reference Number</span>
                        <span className="font-mono text-gray-800">{registrantEvidence.idNumber || 'Not extracted'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-medium">Birthdate</span>
                        <span className="text-gray-800">{registrantEvidence.dateOfBirth ? new Date(registrantEvidence.dateOfBirth).toLocaleDateString() : 'Not extracted'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-gray-500 block uppercase font-medium">Expiry Date</span>
                        <span className="text-gray-800">{registrantEvidence.expiryDate ? new Date(registrantEvidence.expiryDate).toLocaleDateString() : 'Not extracted'}</span>
                      </div>
                    </div>

                    {registrantEvidence.advisoryFlags?.length ? (
                      <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
                        <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-800">Advisory Flags:</span>
                        <div className="flex flex-wrap gap-1.5">
                          {registrantEvidence.advisoryFlags.map((flag, idx) => (
                            <span key={idx} className="bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-amber-300">
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {(registrantEvidence.frontText || registrantEvidence.backText) ? (
                      <details className="text-[10px]">
                        <summary className="cursor-pointer font-semibold text-blue-700 hover:text-blue-900 select-none">
                          View private OCR text
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          <pre className="p-2 bg-gray-900 text-gray-100 rounded text-[9px] font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{registrantEvidence.frontText || 'No front text'}</pre>
                          <pre className="p-2 bg-gray-900 text-gray-100 rounded text-[9px] font-mono whitespace-pre-wrap break-all max-h-40 overflow-y-auto">{registrantEvidence.backText || 'No back text'}</pre>
                        </div>
                      </details>
                    ) : null}

                    <div className="flex items-center gap-2 p-2 bg-amber-50/70 border border-amber-200/60 rounded-lg text-xs text-amber-800">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span className="text-[10px]">
                        Manual review is required. OCR does not verify identity or approve the request.
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Payments Section */}
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-2">Payment Details</span>
            {request.paymentTransactions && request.paymentTransactions.length > 0 ? (
              <div className="space-y-4">
                {request.paymentTransactions.map((tx) => {
                  const receipt = tx.receipts?.[0];
                  const ocr = receipt?.ocrResult;

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
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-gray-700 uppercase">Transaction</span>
                          {(receipt as any)?.attemptVersion != null && (
                            <span className="text-[10px] bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded font-mono font-bold">
                              Attempt #{(receipt as any).attemptVersion}
                            </span>
                          )}
                          {(receipt as any)?.isSuperseded && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-semibold">
                              (Superseded)
                            </span>
                          )}
                        </div>
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
                      {receipt && (
                        <div>
                          <span className="text-[10px] text-gray-400 block uppercase mb-1">Receipt Image (Original Quality)</span>
                          <SecureBlobViewer
                            endpoint={`/document-requests/${request.id}/receipts/${receipt.id}/download`}
                            fileName={receipt.fileName}
                            mimeType={receipt.mimeType}
                            alt="Secure receipt proof"
                            compact
                          />
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
                <div>
                  <h3 className="text-base font-bold text-gray-900">Reject Document &amp; Request Correction</h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Select a canonical reason and affected requirement(s). The request will transition to Needs Correction.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => !isUpdating && setShowCorrectionModal(false)}
                  disabled={isUpdating}
                  className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"
                  aria-label="Close"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {correctionModalError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{correctionModalError}</span>
                </div>
              )}

              {/* Canonical Reason Selection */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest block">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <CustomSelect
                  id="rejection-reason"
                  value={correctionReasonCode}
                  onChange={(val) => setCorrectionReasonCode(val ? String(val) : '')}
                  options={CANONICAL_CORRECTION_REASONS.map((r) => ({
                    value: r.code,
                    label: r.label,
                  }))}
                  placeholder="-- Select a reason --"
                  disabled={isUpdating}
                  searchable={false}
                  aria-label="Rejection Reason"
                />
              </div>

              {/* Affected Requirements Checklist */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold text-gray-700 uppercase tracking-widest block">
                  Affected Requirements <span className="text-red-500">*</span>
                </span>
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
                          disabled={isUpdating}
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

              {/* Optional Parishioner-Visible Note */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] font-bold text-gray-700 uppercase tracking-widest block">
                    Parishioner-Visible Note (Optional)
                  </label>
                  <span className="text-[10px] text-gray-400 font-mono">
                    {correctionNotes.length} / 1000
                  </span>
                </div>
                <textarea
                  value={correctionNotes}
                  onChange={(e) => setCorrectionNotes(e.target.value.slice(0, 1000))}
                  disabled={isUpdating}
                  placeholder="Provide clear, helpful instructions for the parishioner on how to correct the affected documents..."
                  rows={3}
                  maxLength={1000}
                  className="w-full p-3 border border-gray-200 rounded-xl text-xs text-gray-800 outline-none focus:border-[#7B1C2A] focus:ring-1 focus:ring-[#7B1C2A]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 flex-shrink-0">
              <button
                type="button"
                onClick={() => !isUpdating && setShowCorrectionModal(false)}
                disabled={isUpdating}
                className="px-4 py-2 text-xs font-semibold border rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSendCorrection()}
                disabled={isUpdating || !correctionReasonCode || Object.keys(selectedReqs).filter(id => selectedReqs[id]).length === 0}
                className="px-4 py-2 text-xs font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-40 flex items-center gap-1.5"
              >
                {isUpdating ? 'Rejecting...' : 'Reject Document'}
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
        <div className="px-6 py-4 border-t border-gray-100 flex items-start justify-between gap-4 bg-gray-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {canManage ? (
              renderActionButtons()
            ) : (
              <p className="text-xs text-gray-500 italic py-2">
                You have read-only access to document requests.
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 bg-white"
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
  const { role } = useAuth();
  const canManage = canManageDocumentRequests(role);
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType | 'all'>('all');
  const [status, setStatus] = useState<DocumentStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isMutating, setIsMutating] = useState(false);

  const PAGE_SIZE = 5;

  const filters = { search, documentType, status, page, pageSize: PAGE_SIZE };
  const requestQuery = useCachedQuery(['requests', 'list', filters], () => getDocumentRequests(filters), {
    enabled: !selectedRequest && !isMutating,
  });
  const requests = requestQuery.data?.data ?? [];
  const total = requestQuery.data?.total ?? 0;
  const totalPages = requestQuery.data?.totalPages ?? 1;
  const isLoading = requestQuery.loading;
  const error = requestQuery.error;
  const fetchRequests = requestQuery.refetch;
  const setRequests = (update: SetStateAction<DocumentRequest[]>) => requestQuery.setData(previous => previous ? {
    ...previous, data: typeof update === 'function' ? update(previous.data) : update,
  } : previous);

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

  const handleStatusUpdate = async (
    newStatus: DocumentStatus,
    remarks?: string,
    correctionRequirementIds?: string[],
    correctionReasonCode?: string,
    correctionNote?: string
  ) => {
    if (!canManage || !selectedRequest) return;
    setIsMutating(true);

    try {
      const updated = await updateDocumentStatus(
        selectedRequest.id,
        newStatus,
        remarks,
        correctionRequirementIds,
        correctionReasonCode,
        correctionNote
      );

      // Hydrate state directly from authoritative response DTO
      setSelectedRequest(updated);
      setRequests(prev => prev.map(r => r.id === updated.id ? updated : r));
      setToastMessage(`Request status updated to ${newStatus}.`);

      try {
        await fetchRequests(true);
      } catch (refreshErr) {
        console.error('Refresh after update failed:', refreshErr);
        setToastMessage(`Updated to ${newStatus}, but list refresh failed.`);
      }
    } catch (err: any) {
      console.error('Failed to update status:', err);
      throw err;
    } finally {
      setIsMutating(false);
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
        subtitle="Review and process parishioner sacramental document requests."
      />

      {!canManage && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2 text-xs text-blue-800">
          <AlertCircle className="w-4 h-4 text-blue-600 shrink-0" />
          <span>You have read-only access to document requests.</span>
        </div>
      )}

      {/* Filter and Search Card */}
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
          onRefetchRequest={async () => {
            const result = await fetchRequests(true);
            if (result?.error) throw result.error;
            const fresh = result?.data?.data.find(r => r.id === selectedRequest.id);
            if (fresh) setSelectedRequest(fresh);
          }}
          canManage={canManage}
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
