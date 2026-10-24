import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, AlertCircle, FileText, Clock, ArrowLeft, Calendar, Building, User, Loader2, ArrowRight, RotateCcw, X, Eye, Download, AlertTriangle, FileEdit } from 'lucide-react';
import services from '../../providers/factory';
import { useRequests } from '../../hooks/useService';
import { useProfileRequirement } from '../../hooks/useProfileRequirement';
import type { SacramentalRequest, RequestStatus, Appointment } from '../../types';
import { DOCUMENT_RETURN_REASONS } from '../../types';
import { client } from '../../api/client';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SearchInput } from '../../components/ui/SearchInput';
import { CustomSelect } from '../../components/ui/CustomSelect';
import { Skeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import PaymentInstructionsCard from '../../features/payments/components/PaymentInstructionsCard';
import ReceiptUploadCard from '../../features/payments/components/ReceiptUploadCard';
import { ErrorState } from '../../components/ui/ErrorState';
import ScheduleRescheduleHistory from '../../features/scheduler/components/ScheduleRescheduleHistory';
import { UPLOAD_POLICIES, validateUploadFile } from '../../utils/uploadPolicy';
import SecureFileActions from '../../components/files/SecureFileActions';
import { Modal } from '../../components/ui/Modal';
import { formatActionLabel, formatHistoryRemarks } from '../../features/requests/presentation';

const getBadgeVariant = (status: any): 'pending' | 'under-review' | 'ready' | 'rejected' | 'neutral' | 'crimson' | 'correction' => {
  switch (status) {
    case 'pending':
      return 'pending';
    case 'under-review':
    case 'payment-under-review':
      return 'under-review';
    case 'ready':
      return 'ready';
    case 'completed':
      return 'ready';
    case 'returned':
      return 'correction';
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
  if (status === 'returned') return 'Returned for Correction';
  if (status === 'completed') return 'Released';
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

interface SecureReturnFileActionsProps {
  requestId: string | number;
  returnId: number;
  type: 'returned' | 'corrected';
  fileName: string;
  mimeType?: string | null;
}

const SecureReturnFileActions: React.FC<SecureReturnFileActionsProps> = ({
  requestId,
  returnId,
  type,
  fileName,
  mimeType,
}) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }, [objectUrl]);

  const load = async () => {
    if (objectUrl) return objectUrl;
    setLoading(true);
    setError(null);
    try {
      const blob = await client.getBlob(`/requests/${requestId}/returns/${returnId}/file/${type}`);
      const nextUrl = URL.createObjectURL(blob);
      setObjectUrl(nextUrl);
      return nextUrl;
    } catch (err: any) {
      setError(err?.message || 'Secure file could not be loaded.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  const download = async () => {
    const url = await load();
    if (!url) return;
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
  };

  const isImage = String(mimeType || '').startsWith('image/');

  return (
    <div className="space-y-2 pt-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md border border-border bg-white px-2 py-1 text-[10px] font-semibold text-text-primary hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : <Eye size={11} />}
          Secure Preview
        </button>
        <button
          type="button"
          onClick={() => void download()}
          disabled={loading}
          className="inline-flex items-center gap-1 rounded-md bg-crimson px-2 py-1 text-[10px] font-semibold text-white hover:bg-crimson-dark disabled:opacity-50"
        >
          <Download size={11} /> Download
        </button>
      </div>
      {objectUrl && isImage && (
        <img src={objectUrl} alt={fileName} className="max-h-64 w-full rounded-lg border border-border bg-gray-50 object-contain" />
      )}
      {objectUrl && !isImage && (
        <a href={objectUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] font-semibold text-blue-600 hover:underline">
          Open authenticated document preview
        </a>
      )}
      {error && <p className="text-[10px] text-red-600" role="alert">{error}</p>}
    </div>
  );
};

export const RequestTrackingPage: React.FC = () => {
  const navigate = useNavigate();
  const { requireCompleteProfile } = useProfileRequirement();

  const requestsQuery = useRequests();
  // Keep a completed deletion hidden even if a previously started poll returns stale data.
  const [deletedDraftIds, setDeletedDraftIds] = useState<Set<string>>(() => new Set());
  const requests = useMemo(() => (requestsQuery.data ?? EMPTY_REQUESTS).filter(request => !deletedDraftIds.has(String(request.id))), [requestsQuery.data, deletedDraftIds]);
  const savedDrafts = requests.filter(request => request.isDraft === true);
  const submittedRequests = requests.filter(request => request.isDraft === false);
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

  const [searchParams] = useSearchParams();
  const deepLinkRequestId = searchParams.get('requestId');

  // Stable source of truth for selection is the ID, not a stale copied object
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [searchedRequest, setSearchedRequest] = useState<SacramentalRequest | null>(null);

  useEffect(() => {
    if (deepLinkRequestId) {
      setSelectedRequestId(deepLinkRequestId);
      setActiveMode('documents');
      if (isMobile) {
        setMobileView('details');
      }
    }
  }, [deepLinkRequestId, isMobile]);

  useEffect(() => {
    if (!deepLinkRequestId || requestsQuery.loading) return;
    const found = requests.some(r => String(r.id) === String(deepLinkRequestId));
    if (!found && !searchedRequest) {
      void services.request.getRequestById(deepLinkRequestId).then(res => {
        if (res) setSearchedRequest(res);
      }).catch(() => {});
    }
  }, [deepLinkRequestId, requests, requestsQuery.loading, searchedRequest]);
  const [draftToDelete, setDraftToDelete] = useState<SacramentalRequest | null>(null);
  const [deletingDraft, setDeletingDraft] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const deleteInProgressRef = useRef(false);

  // Derive selectedRequest directly from latest polling/refetched requests array
  const selectedRequest = useMemo(() => {
    if (!selectedRequestId || deletedDraftIds.has(String(selectedRequestId))) return null;
    const found = requests.find(r => String(r.id) === String(selectedRequestId));
    if (found) return found;
    if (searchedRequest && String(searchedRequest.id) === String(selectedRequestId)) {
      return searchedRequest;
    }
    return null;
  }, [requests, selectedRequestId, searchedRequest, deletedDraftIds]);

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
  const [alternativeBusy, setAlternativeBusy] = useState(false);
  const [alternativeError, setAlternativeError] = useState<string | null>(null);

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

  const handleWithdrawAlternative = async () => {
    const proposal = selectedSchedule?.alternativeProposal;
    if (!selectedSchedule || !proposal) return;
    setAlternativeBusy(true);
    setAlternativeError(null);
    try {
      await services.scheduler.withdrawAlternativeDate(
        selectedSchedule.id,
        proposal.id,
        proposal.nominationRevision
      );
      const refreshed = await services.scheduler.getAppointmentById(selectedSchedule.id);
      setSchedules((items) => items.map((item) => String(item.id) === String(refreshed.id) ? refreshed : item));
      if (searchedSchedule && String(searchedSchedule.id) === String(refreshed.id)) {
        setSearchedSchedule(refreshed);
      }
    } catch (err: any) {
      setAlternativeError(err?.message || 'Unable to withdraw the alternative-date request.');
    } finally {
      setAlternativeBusy(false);
    }
  };

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
    const hasServiceLeader = isPriestAssigned || Boolean(schedule.layMinisterAssigned);
    const serviceLeaderConfirmed = isPriestAccepted || Boolean(schedule.layMinisterAssigned);
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
        label: 'Service Leader Assigned',
        done: hasServiceLeader,
        desc: schedule.layMinisterAssigned
          ? 'A Lay Minister will lead this service.'
          : schedule.assignedPriestName
          ? `Assigned to Rev. Fr. ${schedule.assignedPriestName}.`
          : 'Parish office is assigning an available priest.',
      },
      {
        key: 'priest-accepted',
        label: 'Assignment Confirmed',
        done: serviceLeaderConfirmed,
        desc: schedule.layMinisterAssigned
          ? 'The Lay Minister assignment is confirmed; no priest acceptance is required.'
          : isPriestAccepted
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

  // Post-Release Document Return State (COMPLETED -> RETURNED)
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [returnReason, setReturnReason] = useState<string>('');
  const [returnNotes, setReturnNotes] = useState<string>('');
  const [returnFile, setReturnFile] = useState<File | null>(null);
  const [returnFileError, setReturnFileError] = useState<string | null>(null);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnSubmitError, setReturnSubmitError] = useState<string | null>(null);
  const returnSubmitInFlightRef = useRef(false);

  const handleReturnFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setReturnFile(null);
      return;
    }
    const result = validateUploadFile(file, UPLOAD_POLICIES.CORRECTION_DOCUMENT);
    if (!result.valid) {
      setReturnFileError(result.error || 'Invalid file format. Accepted formats: PDF, JPG, PNG, or WebP up to 5 MB.');
      setReturnFile(null);
      return;
    }
    setReturnFileError(null);
    setReturnFile(file);
  };

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (returnSubmitInFlightRef.current) return;
    if (!selectedRequest) return;
    if (!returnReason) {
      setReturnSubmitError('Please select a reason for returning the document.');
      return;
    }
    if (!returnFile) {
      setReturnFileError('Please attach an image or PDF of the defective issued document.');
      return;
    }

    returnSubmitInFlightRef.current = true;
    setSubmittingReturn(true);
    setReturnSubmitError(null);

    try {
      if (services.request.returnDocument) {
        await services.request.returnDocument(
          String(selectedRequest.id),
          returnReason,
          returnFile,
          returnNotes.trim() || undefined
        );
      } else {
        const formData = new FormData();
        formData.append('reasonCode', returnReason);
        if (returnNotes.trim()) {
          formData.append('notes', returnNotes.trim());
        }
        formData.append('file', returnFile);
        await client.post(`/requests/${selectedRequest.id}/return-document`, formData);
      }

      setIsReturnModalOpen(false);
      setReturnReason('');
      setReturnNotes('');
      setReturnFile(null);
      setReturnFileError(null);
      await refetch();
    } catch (err: any) {
      console.error('Failed to submit return:', err);
      setReturnSubmitError(err.message || 'Failed to submit document return. Please try again.');
    } finally {
      returnSubmitInFlightRef.current = false;
      setSubmittingReturn(false);
    }
  };

  // Parse query parameter for specific request ID
  const queryParams = new URLSearchParams(window.location.search);
  const paramRequestId = queryParams.get('requestId');

  // Sync selected request ID on initial load or query param change
  useEffect(() => {
    if (requests.length > 0) {
      if (paramRequestId && !deletedDraftIds.has(paramRequestId)) {
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
  }, [requests, selectedRequestId, paramRequestId, navigate, deletedDraftIds]);

  const openDraftDeletion = (draft: SacramentalRequest) => {
    if (draft.isDraft !== true || deleteInProgressRef.current) return;
    setDeleteError(null);
    setDeleteMessage(null);
    setDraftToDelete(draft);
  };

  const handleDeleteDraft = async () => {
    if (!draftToDelete || draftToDelete.isDraft !== true || deleteInProgressRef.current) return;
    deleteInProgressRef.current = true;
    setDeletingDraft(true);
    setDeleteError(null);
    try {
      const result = await services.request.deleteDraft(String(draftToDelete.id));
      const id = String(draftToDelete.id);
      setDeletedDraftIds(previous => new Set([...previous, id]));
      setSelectedRequestId(previous => String(previous) === id ? null : previous);
      setSearchedRequest(previous => String(previous?.id) === id ? null : previous);
      setDraftToDelete(null);
      setMobileView('requests');
      setDeleteMessage(result.cleanupQueued ? 'Draft deleted. Uploaded files are queued for secure cleanup.' : 'Draft deleted successfully.');
      if (paramRequestId === id) navigate('/dashboard/track', { replace: true });
    } catch (err: any) {
      setDeleteError(err?.message || 'Unable to delete this draft. Please try again.');
    } finally {
      deleteInProgressRef.current = false;
      setDeletingDraft(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchError(false);
    setSearchCompleted(true);
    try {
      const match = await services.request.getRequestByTrackingNumber(searchQuery.trim());
      if (match && !deletedDraftIds.has(String(match.id))) {
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
        done: status === 'ready' || status === 'completed' || status === 'returned',
        desc: status === 'ready' || status === 'completed' || status === 'returned' ? 'Registry verified and document signed.' : 'Locating archival book, volume, and folio entries.'
      },
      {
        key: 'pickup',
        label: 'Ready for Collection',
        done: status === 'ready' || status === 'completed' || status === 'returned',
        desc: status === 'ready' || status === 'completed' || status === 'returned' ? 'The original document was released; a post-release correction is now in progress.' : 'Pending final preparation and seal.'
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

      {deleteMessage && <p role="status" className="p-3 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-card">{deleteMessage}</p>}

      {/* Mode Switcher Tabs */}
      <div
        className="flex bg-app-page p-1 rounded-card border border-border max-w-md w-full mb-2 sm:mb-0"
        role="tablist"
        aria-label="Tracking category"
      >
        <button
          id="tracking-mode-tab-documents"
          type="button"
          role="tab"
          aria-selected={activeMode === 'documents'}
          aria-controls="tracking-mode-panel-documents"
          onClick={() => {
            setActiveMode('documents');
            setMobileView('requests');
          }}
          className={`flex-1 py-2 px-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-1.5 sm:gap-2 focus-ring ${
            activeMode === 'documents'
              ? 'bg-white text-crimson shadow-xs border border-border/50'
              : 'text-gray-600 hover:text-text-primary'
          }`}
        >
          <FileText size={15} className="shrink-0" />
          <span className="truncate">Document Requests</span>
        </button>
        <button
          id="tracking-mode-tab-schedules"
          type="button"
          role="tab"
          aria-selected={activeMode === 'schedules'}
          aria-controls="tracking-mode-panel-schedules"
          onClick={() => {
            setActiveMode('schedules');
            setMobileScheduleView('schedules');
          }}
          className={`flex-1 py-2 px-2 text-xs font-bold rounded-button transition-all flex items-center justify-center gap-1.5 sm:gap-2 focus-ring ${
            activeMode === 'schedules'
              ? 'bg-white text-crimson shadow-xs border border-border/50'
              : 'text-gray-600 hover:text-text-primary'
          }`}
        >
          <Calendar size={15} className="shrink-0" />
          <span className="truncate">Schedule Requests</span>
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
                <div className="mb-3.5 border-b border-border pb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileEdit size={16} className="text-crimson" />
                    <h2 className="text-sm font-bold text-text-primary">Saved Drafts</h2>
                  </div>
                  {savedDrafts.length > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-crimson/10 text-crimson">
                      {savedDrafts.length}
                    </span>
                  )}
                </div>
                <div className="space-y-3">
                  {savedDrafts.length === 0 && <p className="text-xs text-text-muted">No saved drafts.</p>}
                  {savedDrafts.map(draft => (
                    <div key={draft.id} className="p-3.5 rounded-button border border-border/80 bg-white hover:border-crimson/30 shadow-2xs transition-all space-y-2.5">
                      <div className="flex justify-between items-center gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <FileText size={14} className="text-crimson shrink-0" />
                          <span className="text-xs font-mono font-bold text-text-primary truncate">{draft.trackingNumber}</span>
                        </div>
                        <Badge variant="neutral">Draft</Badge>
                      </div>
                      <p className="text-xs text-text-muted capitalize">
                        {draft.documentType} Certificate · <span className="text-text-primary font-medium">{draft.applicantName}</span>
                      </p>
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        <Button size="sm" variant="outline" className="font-semibold shadow-2xs" onClick={() => navigate(`/dashboard/request?draftId=${draft.id}`)}>Resume Draft</Button>
                        <Button size="sm" variant="primary" onClick={() => openDraftDeletion(draft)}>Discard Draft</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="bg-white rounded-card border border-border p-5 shadow-xs">
                <div className="mb-3.5 border-b border-border pb-2.5">
                  <h2 className="text-sm font-bold text-text-primary">My Submitted Requests</h2>
                </div>
                <div className="space-y-2.5 pt-0">
                  {submittedRequests.length === 0 && <p className="text-xs text-text-muted">No submitted requests.</p>}
                  {submittedRequests.map(req => {
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
              {/* Back to My Requests button on mobile */}
              <div className="lg:hidden">
                <button
                  type="button"
                  onClick={() => setMobileView('requests')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-crimson bg-red-50/80 hover:bg-red-100 border border-crimson/20 rounded-button shadow-2xs transition-colors focus-ring cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to My Requests</span>
                </button>
              </div>


              {selectedRequest ? (
                selectedRequest.isDraft === true ? (
                  <Card className="border-border shadow-xs">
                    <CardHeader className="border-b border-border pb-4">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                          <FileEdit className="w-5 h-5 text-crimson" />
                          <CardTitle className="font-mono">{selectedRequest.trackingNumber}</CardTitle>
                        </div>
                        <Badge variant="neutral">Draft</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="p-3.5 bg-amber-50/80 border border-amber-200/80 rounded-button space-y-1">
                        <p className="text-xs font-semibold text-amber-900">Unsubmitted Draft</p>
                        <p className="text-xs text-amber-800">This is a saved draft. It has not been submitted to the parish office.</p>
                      </div>
                      <div className="text-xs space-y-1">
                        <span className="text-text-muted font-medium">Registrant: </span>
                        <span className="font-bold text-text-primary">{selectedRequest.applicantName}</span>
                      </div>
                      <div className="flex flex-wrap gap-2.5 pt-2">
                        <Button variant="outline" className="font-semibold" onClick={() => navigate(`/dashboard/request?draftId=${selectedRequest.id}`)}>Resume Draft</Button>
                        <Button variant="primary" onClick={() => openDraftDeletion(selectedRequest)}>Discard Draft</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : selectedRequest.status === 'payment-pending' ? authoritativePaymentAmount === null ? (
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
                          <SecureFileActions
                            endpoint={'/requests/' + selectedRequest.id + '/receipts/' + selectedRequest.paymentTransactions[0].receipts[0].id + '/download'}
                            fileName={selectedRequest.paymentTransactions[0].receipts[0].fileName}
                            mimeType={selectedRequest.paymentTransactions[0].receipts[0].mimeType}
                            compact
                            showDownload={false}
                            viewLabel="View Receipt"
                          />
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

                      {/* Submitted Documents & Existing Uploads */}
                      <div className="space-y-3 text-left">
                        <div className="flex items-center justify-between border-b border-border/40 pb-2">
                          <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                            Submitted Documents & Evidence
                          </h3>
                          <span className="text-[10px] text-text-muted font-mono uppercase">
                            {(selectedRequest.attachments?.length || 0) + (selectedRequest.relationship === 'Self' ? 1 : 0)} Item(s)
                          </span>
                        </div>

                        {selectedRequest.relationship === 'Self' && (
                          <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs">
                            <div className="flex items-center gap-2.5">
                              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                              <div>
                                <span className="font-bold text-emerald-950 block">Requester Government ID</span>
                                <span className="text-[10px] text-emerald-800">Verified via TESTIMONIUM Profile (satisfies ID requirement for Self)</span>
                              </div>
                            </div>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                              Verified
                            </span>
                          </div>
                        )}

                        {selectedRequest.attachments && selectedRequest.attachments.length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {selectedRequest.attachments.map((att) => {
                              return (
                                <div key={att.id} className="p-3 bg-gray-50/80 border border-gray-150 rounded-xl flex items-center justify-between gap-3 text-xs">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <FileText size={16} className="text-gray-400 shrink-0" />
                                    <div className="min-w-0">
                                      <span className="truncate block font-semibold text-text-primary" title={att.fileName}>
                                        {att.fileName}
                                      </span>
                                      <span className="text-[10px] text-text-muted capitalize block">
                                        {att.category === 'authorization_letter'
                                          ? 'Signed Authorization Letter'
                                          : att.category === 'registrant_id_front'
                                          ? 'Registrant ID (Front)'
                                          : att.category === 'registrant_id_back'
                                          ? 'Registrant ID (Back)'
                                          : att.category.replace(/_/g, ' ')} • {new Date(att.uploadedAt).toLocaleDateString()}
                                      </span>
                                    </div>
                                  </div>
                                  <SecureFileActions
                                    endpoint={'/requests/' + selectedRequest.id + '/attachments/' + att.id + '/download'}
                                    fileName={att.fileName}
                                    mimeType={att.fileType}
                                    compact
                                    showDownload={false}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : selectedRequest.relationship !== 'Self' ? (
                          <p className="text-xs text-text-muted italic bg-app-page p-3 rounded-lg border border-border/50">
                            No files attached to this request.
                          </p>
                        ) : null}
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
                                        <SecureFileActions
                                          endpoint={'/requests/' + selectedRequest.id + '/attachments/' + existingFile.id + '/download'}
                                          fileName={existingFile.fileName}
                                          mimeType={existingFile.fileType}
                                          compact
                                          showDownload={false}
                                        />
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

                      {/* Post-Release Return Action Card */}
                      {selectedRequest.status === 'completed' && (
                        <div className="p-4 bg-gray-50 border border-border rounded-card space-y-3 text-left">
                          <div className="flex items-start space-x-2.5">
                            <FileText size={18} className="text-crimson mt-0.5 flex-shrink-0" />
                            <div>
                              <h4 className="text-xs font-bold text-text-primary">Need a Correction on Your Issued Certificate?</h4>
                              <p className="text-xs text-text-muted mt-1 leading-relaxed">
                                If your issued and collected document has a typographical error, misspelling, incorrect sacramental date, or physical defect, you may return it for a free official correction.
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-end">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setReturnSubmitError(null);
                                setReturnFileError(null);
                                setIsReturnModalOpen(true);
                              }}
                              className="border-crimson text-crimson hover:bg-crimson/5 font-semibold"
                            >
                              Return Document for Correction
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Returned for Correction Status Card */}
                      {selectedRequest.status === 'returned' && (
                        <div className="p-5 bg-amber-50/70 border border-amber-300 rounded-card space-y-4 text-left">
                          <div className="flex items-start space-x-2.5">
                            <RotateCcw size={18} className="text-amber-700 mt-0.5 flex-shrink-0" />
                            <div className="flex-1">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-amber-900">Document Returned for Free Correction</h4>
                                <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  In Progress
                                </span>
                              </div>
                              <p className="text-xs text-amber-800 mt-1 leading-relaxed">
                                You have returned this document for correction. Parish staff has been notified and is currently re-verifying church records and preparing your corrected certificate. You will be notified via email and in-app once it is ready for collection.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Return Cycle History */}
                      {selectedRequest.returns && selectedRequest.returns.length > 0 && (
                        <div className="space-y-3 pt-2 text-left">
                          <div className="flex items-center justify-between border-b border-border/40 pb-2">
                            <h3 className="text-xs font-bold text-text-primary uppercase tracking-wider">
                              Document Return History
                            </h3>
                            <span className="text-[10px] text-text-muted font-mono uppercase">
                              {selectedRequest.returns.length} Return Cycle{selectedRequest.returns.length > 1 ? 's' : ''}
                            </span>
                          </div>
                          <div className="space-y-3">
                            {selectedRequest.returns.map((ret) => (
                              <div key={ret.id} className="p-3 bg-white border border-border/80 rounded-xl space-y-3 text-xs">
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-bold text-text-primary">
                                    Return Cycle #{ret.cycleNumber}: {DOCUMENT_RETURN_REASONS[ret.reasonCode as keyof typeof DOCUMENT_RETURN_REASONS] || ret.reasonCode}
                                  </span>
                                  <span className="text-[10px] text-text-muted shrink-0 whitespace-nowrap">
                                    {new Date(ret.returnedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                {ret.notes && (
                                  <p className="text-text-muted italic bg-gray-50 p-2 rounded border border-gray-100 text-[11px]">
                                    "{ret.notes}"
                                  </p>
                                )}

                                {/* Defective Document */}
                                <div className="rounded-lg border border-red-200/60 bg-red-50/30 p-2.5 space-y-1.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-700">
                                      <AlertCircle size={13} className="shrink-0 text-red-600" />
                                      Defective Document
                                    </span>
                                  </div>
                                  <p className="text-[11px] font-medium text-text-primary break-all" title={ret.returnedFileName}>
                                    {ret.returnedFileName}
                                  </p>
                                  <SecureReturnFileActions
                                    requestId={selectedRequest.id}
                                    returnId={ret.id}
                                    type="returned"
                                    fileName={ret.returnedFileName}
                                    mimeType={ret.returnedFileType}
                                  />
                                </div>

                                {/* Corrected Document */}
                                {ret.correctedFileName ? (
                                  <div className="rounded-lg border border-emerald-200/70 bg-emerald-50/30 p-2.5 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800">
                                        <CheckCircle2 size={13} className="shrink-0 text-emerald-600" />
                                        Corrected Document
                                      </span>
                                      {ret.correctedAt && (
                                        <span className="text-[10px] text-emerald-700 font-medium">
                                          Corrected on {new Date(ret.correctedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] font-medium text-text-primary break-all" title={ret.correctedFileName}>
                                      {ret.correctedFileName}
                                    </p>
                                    <SecureReturnFileActions
                                      requestId={selectedRequest.id}
                                      returnId={ret.id}
                                      type="corrected"
                                      fileName={ret.correctedFileName}
                                      mimeType={ret.correctedFileType}
                                    />
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 rounded-lg border border-amber-200/70 bg-amber-50/50 px-3 py-2 text-amber-800 text-[11px]">
                                    <Clock size={13} className="shrink-0 text-amber-600" />
                                    <span className="font-medium">Awaiting staff correction</span>
                                  </div>
                                )}
                              </div>
                            ))}
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
                                const heading = formatActionLabel(h.action, h);
                                const formattedRemarks = formatHistoryRemarks(h);
                                const showRemarks = formattedRemarks && formattedRemarks.trim().toLowerCase() !== heading.trim().toLowerCase();
                                return (
                                  <div key={h.id} className="relative text-left">
                                    <div className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full border-2 border-crimson bg-crimson text-white flex items-center justify-center">
                                      <CheckCircle2 size={10} className="stroke-[3]" />
                                    </div>
                                    <div>
                                      <h4 className="text-xs font-bold text-text-primary">
                                        {heading}
                                      </h4>
                                      {showRemarks && (
                                        <p className="text-xs text-text-muted mt-0.5 whitespace-pre-line">
                                          {formattedRemarks}
                                        </p>
                                      )}
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
              {/* Back to My Schedules button on mobile */}
              <div className="lg:hidden mb-4">
                <button
                  type="button"
                  onClick={() => setMobileScheduleView('schedules')}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-crimson bg-red-50/80 hover:bg-red-100 border border-crimson/20 rounded-button shadow-2xs transition-colors focus-ring cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back to My Schedules</span>
                </button>
              </div>
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
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-widest">Service Leader</span>
                        <p className="font-semibold text-text-primary flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-crimson flex-shrink-0" />
                          {selectedSchedule.layMinisterAssigned
                            ? 'Lay Minister'
                            : selectedSchedule.assignedPriestName
                            ? `Rev. Fr. ${selectedSchedule.assignedPriestName}`
                            : 'Pending assignment by parish'}
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

                    {selectedSchedule.layMinisterAssigned && (
                      <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-xs text-amber-900 space-y-3">
                        <div className="flex items-center gap-2 font-bold text-amber-950">
                          <AlertTriangle className="w-4 h-4 text-amber-700" />
                          <span>Lay Minister fallback</span>
                        </div>
                        <p className="leading-relaxed">
                          No priest was available for this appointment slot. The original appointment remains confirmed and will be led by an authorized Lay Minister.
                        </p>
                        {selectedSchedule.alternativeProposal && ['SUBMITTED', 'PRIEST_PENDING'].includes(selectedSchedule.alternativeProposal.status) ? (
                          <div className="p-3 bg-white rounded-lg border border-amber-200/80 space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-semibold text-gray-900">Alternative Request:</span>
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                                selectedSchedule.alternativeProposal.status === 'PRIEST_PENDING'
                                  ? 'bg-purple-50 text-purple-700 border-purple-200'
                                  : 'bg-amber-100/80 text-amber-800 border-amber-300'
                              }`}>
                                {selectedSchedule.alternativeProposal.status === 'PRIEST_PENDING' ? 'Awaiting Nominated Priest' : 'Awaiting Parish Review'}
                              </span>
                            </div>
                            <p className="text-[11px] text-gray-600">
                              {selectedSchedule.alternativeProposal.status === 'PRIEST_PENDING'
                                ? `Parish office nominated Rev. Fr. ${selectedSchedule.alternativeProposal.nominatedPriest?.fullName || 'the celebrant'}. Confirmation pending.`
                                : 'Parish office is reviewing priest availability to nominate a celebrant for your requested date.'}
                            </p>
                            <div className="pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={alternativeBusy}
                                onClick={() => void handleWithdrawAlternative()}
                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                {alternativeBusy ? 'Withdrawing…' : 'Withdraw alternative request'}
                              </Button>
                            </div>
                          </div>
                        ) : selectedSchedule.canProposeAlternativeDate ? (
                          <div className="pt-1 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <span className="text-[11px] text-amber-800">
                              Prefer a priest-led service? You may request an alternative date.
                            </span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => navigate(`/dashboard/schedule/${selectedSchedule.id}`)}
                              className="text-xs shrink-0"
                            >
                              Request Alternative Date
                            </Button>
                          </div>
                        ) : null}
                        {alternativeError && <p className="mt-2 text-red-700" role="alert">{alternativeError}</p>}
                      </div>
                    )}

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

      {draftToDelete && (
        <Modal isOpen onClose={() => { if (!deleteInProgressRef.current) setDraftToDelete(null); }} title="Discard saved draft?" size="sm">
          <div className="space-y-4">
            <p className="text-sm text-text-muted">Discard draft {draftToDelete.trackingNumber}? Its saved details and uploaded requirements, including private registrant-ID images, will be permanently removed. This cannot be undone.</p>
            {deleteError && <p role="alert" className="text-sm text-red-700">{deleteError}</p>}
            <div className="flex justify-end gap-3">
              <Button variant="outline" disabled={deletingDraft} onClick={() => setDraftToDelete(null)}>Keep Draft</Button>
              <Button variant="primary" loading={deletingDraft} onClick={handleDeleteDraft}>Discard Draft</Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Return Document for Correction Modal */}
      {isReturnModalOpen && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[10050] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-border max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-crimson" />
                <h3 className="font-bold text-base text-text-primary">Return Document for Correction</h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!submittingReturn) {
                    setIsReturnModalOpen(false);
                    setReturnSubmitError(null);
                    setReturnFileError(null);
                  }
                }}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-gray-100 transition-colors"
                disabled={submittingReturn}
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
              <p className="font-bold">Free Post-Release Document Correction</p>
              <p className="text-amber-800 leading-relaxed font-normal">
                If the physical certificate released to you has a typographical error, wrong sacramental date, misspelling, or format defect, you can request an official free re-issuance.
              </p>
            </div>

            <form onSubmit={handleSubmitReturn} className="space-y-4 text-left">
              {/* Return Reason Select */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary block">
                  Correction Reason <span className="text-crimson">*</span>
                </label>
                <CustomSelect
                  value={returnReason}
                  onChange={(val) => setReturnReason(String(val || ''))}
                  options={Object.entries(DOCUMENT_RETURN_REASONS).map(([code, label]) => ({
                    value: code,
                    label,
                  }))}
                  placeholder="Select a reason..."
                  disabled={submittingReturn}
                  size="sm"
                />
              </div>

              {/* Upload Defective Document Evidence */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-text-primary block">
                  Photo / Scan of Defective Document <span className="text-crimson">*</span>
                </label>
                <p className="text-[11px] text-text-muted">
                  Upload a clear image or PDF showing the error on the certificate (PDF, JPG, PNG, or WebP up to 5 MB).
                </p>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  onChange={handleReturnFileChange}
                  disabled={submittingReturn}
                  className="block w-full text-xs text-text-muted file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-crimson/10 file:text-crimson hover:file:bg-crimson/20 cursor-pointer"
                />
                {returnFile && (
                  <p className="text-[11px] text-green-700 font-medium flex items-center gap-1 mt-1">
                    <CheckCircle2 size={12} /> Selected: {returnFile.name} ({(returnFile.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
                {returnFileError && (
                  <p className="text-[11px] text-red-600 font-medium mt-1">
                    {returnFileError}
                  </p>
                )}
              </div>

              {/* Optional Notes */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-text-primary block">
                    Additional Details / Notes <span className="text-text-muted font-normal">(Optional)</span>
                  </label>
                  <span className="text-[10px] text-text-muted">{returnNotes.length}/1000</span>
                </div>
                <textarea
                  value={returnNotes}
                  onChange={(e) => setReturnNotes(e.target.value.slice(0, 1000))}
                  placeholder="Specify the exact error (e.g. 'Father's name is spelled Jonh instead of John')..."
                  rows={3}
                  disabled={submittingReturn}
                  className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-crimson/20 focus:border-crimson resize-none"
                />
              </div>

              {returnSubmitError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {returnSubmitError}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2.5 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!submittingReturn) {
                      setIsReturnModalOpen(false);
                      setReturnSubmitError(null);
                    }
                  }}
                  disabled={submittingReturn}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  loading={submittingReturn}
                  disabled={submittingReturn || !returnReason || !returnFile}
                  className="bg-crimson hover:bg-crimson-dark text-white font-semibold"
                >
                  Submit Return Request
                </Button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default RequestTrackingPage;
