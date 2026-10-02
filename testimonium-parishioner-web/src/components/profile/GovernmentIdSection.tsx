import React, { useEffect, useState, useRef } from 'react';
import { ShieldCheck, AlertCircle, Upload, CheckCircle2, RefreshCw, FileText, Calendar, X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/Card';
import { Button } from '../ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  submitGovernmentIdVerification,
  ID_TYPE_LABELS,
  type GovernmentIdVerificationStatusResponse,
} from '../../api/governmentIdVerification';

export const GovernmentIdSection: React.FC = () => {
  const { appProfile, refreshProfile } = useAuth();
  const toast = useToast();

  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);
  const frontPreviewRef = useRef<string | null>(null);
  const backPreviewRef = useRef<string | null>(null);

  const status = appProfile?.governmentIdVerificationStatus || 'NOT_SUBMITTED';
  const isVerified = Boolean(appProfile?.isGovernmentIdVerified);
  const rejectionReason = appProfile?.governmentIdRejectionReason;
  const verifiedAt = appProfile?.governmentIdVerifiedAt;
  const expiresAt = appProfile?.governmentIdExpiresAt;
  const idType = appProfile?.governmentIdType;
  const isExpired = !isVerified && status === 'VERIFIED';

  useEffect(() => {
    return () => {
      if (frontPreviewRef.current) URL.revokeObjectURL(frontPreviewRef.current);
      if (backPreviewRef.current) URL.revokeObjectURL(backPreviewRef.current);
    };
  }, []);

  const handleFrontSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setSubmitError('Invalid file type. Only JPEG and PNG images are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Front ID image must be 10MB or smaller.');
      return;
    }

    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setFrontFile(file);
    const nextPreview = URL.createObjectURL(file);
    frontPreviewRef.current = nextPreview;
    setFrontPreview(nextPreview);
    setSubmitError(null);
  };

  const handleBackSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setSubmitError('Invalid file type. Only JPEG and PNG images are accepted.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Back ID image must be 10MB or smaller.');
      return;
    }

    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackFile(file);
    const nextPreview = URL.createObjectURL(file);
    backPreviewRef.current = nextPreview;
    setBackPreview(nextPreview);
    setSubmitError(null);
  };

  const clearFront = () => {
    setFrontFile(null);
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    frontPreviewRef.current = null;
    setFrontPreview(null);
    if (frontInputRef.current) frontInputRef.current.value = '';
  };

  const clearBack = () => {
    setBackFile(null);
    if (backPreview) URL.revokeObjectURL(backPreview);
    backPreviewRef.current = null;
    setBackPreview(null);
    if (backInputRef.current) backInputRef.current.value = '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frontFile || !backFile) {
      setSubmitError('Both front and back images of your Government ID are required.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const res: GovernmentIdVerificationStatusResponse = await submitGovernmentIdVerification(
        frontFile,
        backFile
      );

      if (res.status === 'VERIFIED') {
        toast.success('Government ID verified successfully!');
        clearFront();
        clearBack();
        setIsRetrying(false);
        await refreshProfile();
      } else if (res.status === 'REJECTED') {
        clearFront();
        clearBack();
        setSubmitError(res.rejectionMessage || 'Verification failed. Please review the requirements and try again.');
        toast.error(res.rejectionMessage || 'Government ID verification was rejected.');
        await refreshProfile();
      }
    } catch (err: any) {
      console.error('[GovernmentIdSection] Verification error:', err);
      const msg = err?.message || 'An unexpected error occurred during verification. Please try again.';
      setSubmitError(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

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
        {/* STATE: VERIFIED */}
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
                    <strong className="font-semibold">ID Type:</strong> {ID_TYPE_LABELS[idType] || idType}
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
            <h4 className="font-semibold text-sm">Government ID verification expired</h4>
            <p className="text-xs">
              {expiresAt
                ? `Your previous verification expired on ${new Date(expiresAt).toLocaleDateString('en-PH')}. Upload a current ID to verify again.`
                : 'Your previous verification is no longer valid. Upload a current ID to verify again.'}
            </p>
          </div>
        )}

        {/* STATE: REJECTED (when not in retry mode) */}
        {!isVerified && status === 'REJECTED' && !isRetrying && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-button space-y-3">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-red-100 text-red-700 rounded-full shrink-0">
                <AlertCircle size={20} />
              </div>
              <div className="space-y-1">
                <h4 className="font-semibold text-red-950 text-sm">
                  Verification Unsuccessful
                </h4>
                <p className="text-red-800 text-xs leading-relaxed">
                  {rejectionReason === 'IMAGE_BLURRY' &&
                    'The uploaded card image was blurry or unreadable. Please ensure the card is clear, in focus, and properly lit.'}
                  {rejectionReason === 'FRONT_BACK_INCOMPLETE' &&
                    'Both the front and back of the Government ID are required and must be distinct photos.'}
                  {rejectionReason === 'NAME_MISMATCH' &&
                    'The name on your Government ID does not match your profile name. Please make sure your profile name reflects your official legal name.'}
                  {rejectionReason === 'ID_EXPIRED' &&
                    'The submitted Government ID has expired. Please provide a currently valid ID.'}
                  {rejectionReason === 'UNSUPPORTED_OR_INVALID_DOCUMENT' &&
                    'The uploaded document is not a supported Philippine Government card. Supported: PhilSys / National ID, Driver\'s License, UMID, Voter\'s ID, or Postal ID.'}
                  {!rejectionReason &&
                    'Your Government ID verification could not be completed. Please upload a clear photo of a supported card.'}
                </p>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                type="button"
                onClick={() => {
                  setIsRetrying(true);
                  setSubmitError(null);
                }}
              >
                <RefreshCw size={14} className="mr-1.5" />
                Retry Verification
              </Button>
            </div>
          </div>
        )}

        {/* STATE: NOT_SUBMITTED or RETRYING */}
        {(!isVerified && (status === 'NOT_SUBMITTED' || status === 'VERIFIED' || isRetrying)) && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-text-muted leading-relaxed">
              To request sacramental documents or schedule appointments, please verify your identity with a supported Philippine government-issued card:
              <strong className="text-text-primary block mt-1">
                PhilSys / National ID, Driver's License, UMID, Voter's ID, or Postal ID.
              </strong>
            </p>

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-button text-red-700 text-xs flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Front Image Upload */}
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
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
                      title="Remove front image"
                    >
                      <X size={14} />
                    </button>
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                      Front
                    </span>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 hover:border-crimson rounded-button aspect-[85/54] flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors bg-white">
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs font-medium text-text-primary">Upload Front</span>
                    <span className="text-[10px] text-text-muted mt-0.5">JPEG or PNG, up to 10MB</span>
                    <input
                      ref={frontInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleFrontSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>

              {/* Back Image Upload */}
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
                      className="absolute top-2 right-2 p-1 bg-black/60 hover:bg-black text-white rounded-full transition-colors cursor-pointer"
                      title="Remove back image"
                    >
                      <X size={14} />
                    </button>
                    <span className="absolute bottom-2 left-2 bg-black/70 text-white text-[10px] px-2 py-0.5 rounded">
                      Back
                    </span>
                  </div>
                ) : (
                  <label className="border-2 border-dashed border-gray-300 hover:border-crimson rounded-button aspect-[85/54] flex flex-col items-center justify-center p-4 text-center cursor-pointer transition-colors bg-white">
                    <Upload size={24} className="text-gray-400 mb-2" />
                    <span className="text-xs font-medium text-text-primary">Upload Back</span>
                    <span className="text-[10px] text-text-muted mt-0.5">JPEG or PNG, up to 10MB</span>
                    <input
                      ref={backInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={handleBackSelect}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {isRetrying && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsRetrying(false);
                    clearFront();
                    clearBack();
                    setSubmitError(null);
                  }}
                >
                  Cancel
                </Button>
              )}
              <div className="ml-auto">
                <Button
                  type="submit"
                  size="sm"
                  loading={submitting}
                  disabled={submitting || !frontFile || !backFile}
                >
                  {submitting ? 'Verifying with OCR...' : 'Submit ID for Verification'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  );
};
