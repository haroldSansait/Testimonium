import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  FileText,
  Info,
  RefreshCw,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  ID_TYPE_LABELS,
  submitGovernmentIdVerification,
  type GovernmentIdVerificationStatusResponse,
} from '../../api/governmentIdVerification';
import { GovernmentIdVerifyingAnimation } from './GovernmentIdVerifyingAnimation';
import {
  GovernmentIdAttemptTracker,
  getGovernmentIdErrorPresentation,
  getGovernmentIdRejectionPresentation,
  getRetakeSides,
  validateGovernmentIdFile,
  type GovernmentIdFailedSide,
  type GovernmentIdFailureKind,
  type GovernmentIdFailurePresentation,
} from '../../utils/governmentIdVerificationPresentation';

const GOVERNMENT_ID_TIMEOUT_MS = 60_000;

const FAILURE_STYLES: Record<GovernmentIdFailureKind, string> = {
  BUSINESS_REJECTION: 'bg-red-50 border-red-200 text-red-800',
  CONNECTION: 'bg-orange-50 border-orange-200 text-orange-800',
  TEMPORARY: 'bg-violet-50 border-violet-200 text-violet-800',
  IN_PROGRESS: 'bg-blue-50 border-blue-200 text-blue-800',
  RATE_LIMIT: 'bg-amber-50 border-amber-200 text-amber-900',
  UNKNOWN: 'bg-slate-50 border-slate-200 text-slate-800',
};

interface ActiveGovernmentIdRequest {
  attemptId: number;
  controller: AbortController;
}

const isAbortError = (error: unknown): boolean =>
  Boolean(
    error &&
      typeof error === 'object' &&
      'name' in error &&
      error.name === 'AbortError'
  );

export const GovernmentIdSection: React.FC = () => {
  const { appProfile, refreshProfile } = useAuth();
  const toast = useToast();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [failurePresentation, setFailurePresentation] =
    useState<GovernmentIdFailurePresentation | null>(null);
  const [localResult, setLocalResult] =
    useState<GovernmentIdVerificationStatusResponse | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const frontPreviewRef = useRef<string | null>(null);
  const backPreviewRef = useRef<string | null>(null);
  const attemptTrackerRef = useRef(new GovernmentIdAttemptTracker());
  const activeRequestRef = useRef<ActiveGovernmentIdRequest | null>(null);

  const status =
    localResult?.status ||
    appProfile?.governmentIdVerificationStatus ||
    'NOT_SUBMITTED';
  const isVerified = localResult
    ? localResult.status === 'VERIFIED' && localResult.isGovernmentIdVerified
    : Boolean(appProfile?.isGovernmentIdVerified);
  const rejectionReason =
    localResult?.rejectionReason ?? appProfile?.governmentIdRejectionReason;
  const verifiedAt =
    localResult?.verifiedAt ?? appProfile?.governmentIdVerifiedAt;
  const expiresAt =
    localResult?.expiresAt ?? appProfile?.governmentIdExpiresAt;
  const idType = localResult?.idType ?? appProfile?.governmentIdType;
  const isExpired = !isVerified && status === 'VERIFIED';
  const persistedRejectionPresentation = getGovernmentIdRejectionPresentation(
    rejectionReason
  );
  const blocksResubmission =
    failurePresentation?.kind === 'RATE_LIMIT' ||
    failurePresentation?.kind === 'IN_PROGRESS';

  const disposeFrontSelection = useCallback(() => {
    if (frontPreviewRef.current) {
      URL.revokeObjectURL(frontPreviewRef.current);
      frontPreviewRef.current = null;
    }
    setFrontFile(null);
    setFrontPreview(null);
    if (frontInputRef.current) frontInputRef.current.value = '';
  }, []);

  const disposeBackSelection = useCallback(() => {
    if (backPreviewRef.current) {
      URL.revokeObjectURL(backPreviewRef.current);
      backPreviewRef.current = null;
    }
    setBackFile(null);
    setBackPreview(null);
    if (backInputRef.current) backInputRef.current.value = '';
  }, []);

  useEffect(() => {
    const tracker = attemptTrackerRef.current;
    tracker.mount();

    return () => {
      tracker.unmount();
      activeRequestRef.current?.controller.abort();
      activeRequestRef.current = null;

      if (frontPreviewRef.current) {
        URL.revokeObjectURL(frontPreviewRef.current);
        frontPreviewRef.current = null;
      }
      if (backPreviewRef.current) {
        URL.revokeObjectURL(backPreviewRef.current);
        backPreviewRef.current = null;
      }
    };
  }, []);

  const resetDiagnosticForFileMutation = () => {
    attemptTrackerRef.current.invalidate();
    setFailurePresentation(null);
    setValidationError(null);
    setLocalResult(null);
  };

  const handleFrontSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (activeRequestRef.current) {
      event.currentTarget.value = '';
      return;
    }

    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const error = validateGovernmentIdFile(file, 'Front');
    if (error) {
      setValidationError(error);
      event.currentTarget.value = '';
      return;
    }

    resetDiagnosticForFileMutation();
    if (frontPreviewRef.current) {
      URL.revokeObjectURL(frontPreviewRef.current);
    }
    const nextPreview = URL.createObjectURL(file);
    frontPreviewRef.current = nextPreview;
    setFrontFile(file);
    setFrontPreview(nextPreview);
  };

  const handleBackSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (activeRequestRef.current) {
      event.currentTarget.value = '';
      return;
    }

    const file = event.currentTarget.files?.[0];
    if (!file) return;

    const error = validateGovernmentIdFile(file, 'Back');
    if (error) {
      setValidationError(error);
      event.currentTarget.value = '';
      return;
    }

    resetDiagnosticForFileMutation();
    if (backPreviewRef.current) {
      URL.revokeObjectURL(backPreviewRef.current);
    }
    const nextPreview = URL.createObjectURL(file);
    backPreviewRef.current = nextPreview;
    setBackFile(file);
    setBackPreview(nextPreview);
  };

  const clearFront = () => {
    if (activeRequestRef.current) return;
    resetDiagnosticForFileMutation();
    disposeFrontSelection();
  };

  const clearBack = () => {
    if (activeRequestRef.current) return;
    resetDiagnosticForFileMutation();
    disposeBackSelection();
  };

  const handleRetake = (target: GovernmentIdFailedSide) => {
    if (activeRequestRef.current) return;
    resetDiagnosticForFileMutation();
    const sides = getRetakeSides(target);
    if (sides.includes('front')) disposeFrontSelection();
    if (sides.includes('back')) disposeBackSelection();
    setIsRetrying(true);
  };

  const refreshProfileBestEffort = () => {
    void refreshProfile().catch(() => undefined);
  };

  const submitCurrentPair = async () => {
    if (!frontFile || !backFile) {
      setValidationError(
        'Both front and back images of your Government ID are required.'
      );
      return;
    }

    const attemptId = attemptTrackerRef.current.start();
    if (attemptId === null) return;

    const controller = new AbortController();
    activeRequestRef.current = { attemptId, controller };
    let didTimeout = false;
    const timeoutId = window.setTimeout(() => {
      didTimeout = true;
      controller.abort();
    }, GOVERNMENT_ID_TIMEOUT_MS);

    setSubmitting(true);
    setValidationError(null);
    setFailurePresentation(null);
    setLocalResult(null);

    try {
      const response = await submitGovernmentIdVerification(
        frontFile,
        backFile,
        { signal: controller.signal }
      );

      if (!attemptTrackerRef.current.isCurrent(attemptId)) return;
      setLocalResult(response);

      if (response.status === 'VERIFIED') {
        setFailurePresentation(null);
        setIsRetrying(false);
        disposeFrontSelection();
        disposeBackSelection();
        toast.success('Government ID verified successfully!');
        refreshProfileBestEffort();
        return;
      }

      if (response.status === 'REJECTED') {
        setFailurePresentation(
          getGovernmentIdRejectionPresentation(
            response.rejectionReason,
            response.failedSide,
            response.sideIssue
          )
        );
        setIsRetrying(true);
        refreshProfileBestEffort();
        return;
      }

      setFailurePresentation(getGovernmentIdErrorPresentation(null));
      setIsRetrying(true);
    } catch (error: unknown) {
      if (!attemptTrackerRef.current.isCurrent(attemptId)) return;
      if (isAbortError(error) && !didTimeout) return;

      setFailurePresentation(
        didTimeout
          ? getGovernmentIdErrorPresentation({
              kind: 'TIMEOUT',
              code: 'GOVERNMENT_ID_REQUEST_TIMEOUT',
            })
          : getGovernmentIdErrorPresentation(error)
      );
      setIsRetrying(true);
    } finally {
      window.clearTimeout(timeoutId);
      if (activeRequestRef.current?.attemptId === attemptId) {
        activeRequestRef.current = null;
        attemptTrackerRef.current.finish(attemptId);
        if (attemptTrackerRef.current.isCurrent(attemptId)) {
          setSubmitting(false);
        }
      }
    }
  };

  const cancelRetry = () => {
    if (activeRequestRef.current) return;
    attemptTrackerRef.current.invalidate();
    setFailurePresentation(null);
    setValidationError(null);
    setIsRetrying(false);
    disposeFrontSelection();
    disposeBackSelection();
  };

  const showUploadForm =
    !isVerified && (status !== 'REJECTED' || isRetrying);

  return (
    <Card id="government-id-section" className="border-border shadow-sm">
      <CardHeader>
        <CardTitle className="text-base flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={18} className="text-crimson" />
            <span>Government ID Verification</span>
          </div>
          {isVerified && (
            <span className="text-xs bg-emerald-100 text-emerald-800 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={12} />
              Verified
            </span>
          )}
          {!isVerified && status === 'REJECTED' && (
            <span className="text-xs bg-red-100 text-red-800 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle size={12} />
              Rejected
            </span>
          )}
          {!isVerified && status === 'NOT_SUBMITTED' && (
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-0.5 rounded-full">
              Not Submitted
            </span>
          )}
          {isExpired && (
            <span className="text-xs bg-amber-100 text-amber-800 font-semibold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle size={12} />
              Expired
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-xs">
        {isVerified && (
          <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-button space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 text-emerald-700 rounded-full shrink-0">
                <CheckCircle2 size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-emerald-950 text-sm">
                  Government ID Verified
                </h4>
                <p className="text-emerald-800 text-xs">
                  Your identity is verified for official sacramental certificates and parish appointments.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-emerald-200/60 text-emerald-900">
              {idType && (
                <div className="flex items-center gap-2">
                  <FileText size={14} className="text-emerald-600" />
                  <span>
                    <strong className="font-semibold">ID Type:</strong>{' '}
                    {ID_TYPE_LABELS[idType] || idType}
                  </span>
                </div>
              )}
              {verifiedAt && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-emerald-600" />
                  <span>
                    <strong className="font-semibold">Verified On:</strong>{' '}
                    {new Date(verifiedAt).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
              {expiresAt && (
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-emerald-600" />
                  <span>
                    <strong className="font-semibold">Expires:</strong>{' '}
                    {new Date(expiresAt).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {isExpired && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-button text-amber-900 space-y-1">
            <h4 className="font-semibold text-sm">
              Government ID verification expired
            </h4>
            <p className="text-xs">
              {expiresAt
                ? `Your previous verification expired on ${new Date(
                    expiresAt
                  ).toLocaleDateString(
                    'en-PH'
                  )}. Upload a current ID to verify again.`
                : 'Your previous verification is no longer valid. Upload a current ID to verify again.'}
            </p>
          </div>
        )}

        {!isVerified && status === 'REJECTED' && !isRetrying && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-button space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-full shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-red-950 text-sm">
                  {persistedRejectionPresentation.title}
                </h4>
                <p className="text-red-800 text-xs leading-relaxed">
                  {persistedRejectionPresentation.message}
                </p>
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  setIsRetrying(true);
                  setFailurePresentation(null);
                  setValidationError(null);
                }}
              >
                <RefreshCw size={14} className="mr-1.5" />
                Retry Verification
              </Button>
            </div>
          </div>
        )}

        {showUploadForm && (
          <div className="relative">
            {submitting && (
              <div
                role="status"
                aria-live="polite"
                aria-label="Verifying your Government ID"
                className="absolute inset-0 z-20 bg-white/95 backdrop-blur-sm rounded-button flex flex-col items-center justify-center p-6 shadow-sm border border-border"
              >
                <GovernmentIdVerifyingAnimation />
              </div>
            )}
            <div className="space-y-4">
            <p className="text-text-muted leading-relaxed">
              To request sacramental documents or schedule appointments, please
              verify your identity with a supported Philippine government-issued
              card:
              <strong className="text-text-primary block mt-1">
                PhilSys / National ID, Driver&apos;s License, UMID, Voter&apos;s
                ID, or Postal ID.
              </strong>
            </p>

            {validationError && (
              <div
                role="alert"
                className="p-3 bg-red-50 border border-red-200 rounded-button text-red-700 text-xs flex items-start gap-2"
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{validationError}</span>
              </div>
            )}

            {failurePresentation && (
              <div
                role="alert"
                className={`p-3 border rounded-button text-xs flex items-start gap-2 ${FAILURE_STYLES[failurePresentation.kind]}`}
              >
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <div className="space-y-1.5 flex-1">
                  <h4 className="font-semibold text-sm">
                    {failurePresentation.title}
                  </h4>
                  <p className="leading-relaxed">
                    {failurePresentation.message}
                  </p>
                  {failurePresentation.action === 'retake' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting}
                      onClick={() =>
                        handleRetake(
                          failurePresentation.retakeTarget || 'both'
                        )
                      }
                    >
                      {failurePresentation.retakeTarget === 'front'
                        ? 'Retake Front'
                        : failurePresentation.retakeTarget === 'back'
                          ? 'Retake Back'
                          : 'Retake Photos'}
                    </Button>
                  )}
                  {failurePresentation.action === 'retry' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting}
                      onClick={() => void submitCurrentPair()}
                    >
                      Try Again
                    </Button>
                  )}
                  {failurePresentation.action === 'dismiss' && (
                    <Button
                      type="button"
                      size="sm"
                      disabled={submitting}
                      onClick={() => setFailurePresentation(null)}
                    >
                      Got It
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  Front of ID <span className="text-crimson">*</span>
                </label>
                {frontPreview ? (
                  <div className="relative border border-border rounded-button overflow-hidden group bg-gray-50 aspect-[85/54] flex items-center justify-center">
                    <img
                      src={frontPreview}
                      alt="Front of ID"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearFront}
                      disabled={submitting}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-colors cursor-pointer"
                      title="Remove front image"
                      aria-label="Remove front image"
                    >
                      <X size={14} />
                    </button>
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                      Front
                    </span>
                  </div>
                ) : (
                  <label
                    className={`border-2 border-dashed border-gray-300 rounded-button aspect-[85/54] flex flex-col items-center justify-center p-4 text-center transition-colors bg-white ${
                      submitting
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-crimson cursor-pointer'
                    }`}
                  >
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs font-medium text-text-primary">
                      Upload Front
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5">
                      JPEG or PNG, up to 10MB
                    </span>
                    <input
                      ref={frontInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleFrontSelect}
                      disabled={submitting}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-text-primary block">
                  Back of ID <span className="text-crimson">*</span>
                </label>
                {backPreview ? (
                  <div className="relative border border-border rounded-button overflow-hidden group bg-gray-50 aspect-[85/54] flex items-center justify-center">
                    <img
                      src={backPreview}
                      alt="Back of ID"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearBack}
                      disabled={submitting}
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-full transition-colors cursor-pointer"
                      title="Remove back image"
                      aria-label="Remove back image"
                    >
                      <X size={14} />
                    </button>
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                      Back
                    </span>
                  </div>
                ) : (
                  <label
                    className={`border-2 border-dashed border-gray-300 rounded-button aspect-[85/54] flex flex-col items-center justify-center p-4 text-center transition-colors bg-white ${
                      submitting
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:border-crimson cursor-pointer'
                    }`}
                  >
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs font-medium text-text-primary">
                      Upload Back
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5">
                      JPEG or PNG, up to 10MB
                    </span>
                    <input
                      ref={backInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleBackSelect}
                      disabled={submitting}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="p-3 bg-slate-50 border border-border rounded-button flex items-start gap-2.5 text-xs">
              <Info size={16} className="text-slate-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-text-primary leading-relaxed">
                  Make sure the entire ID is clearly visible, readable, well-lit, and not blurry. Avoid glare, shadows, and cropped edges.
                </p>
                <p className="text-[11px] text-text-muted">
                  JPEG or PNG • Maximum 10 MB
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {isRetrying && (
                <Button
                  type="button"
                  variant="outline"
                  size="md"
                  className="px-5"
                  disabled={submitting}
                  onClick={cancelRetry}
                >
                  Cancel
                </Button>
              )}
              <div className="ml-auto">
                <Button
                  type="button"
                  size="md"
                  className="px-5"
                  loading={submitting}
                  onClick={() => void submitCurrentPair()}
                  disabled={
                    submitting ||
                    blocksResubmission ||
                    !frontFile ||
                    !backFile
                  }
                >
                  {submitting
                    ? 'Verifying with OCR...'
                    : 'Submit ID for Verification'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
      </CardContent>
    </Card>
  );
};
