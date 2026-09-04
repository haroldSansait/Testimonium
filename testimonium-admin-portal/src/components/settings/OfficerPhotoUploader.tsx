import React, { useRef, useState } from 'react';
import { Camera, Trash2, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { ParishCouncilService } from '@/services/ParishCouncilService';

export interface OfficerPhotoUploaderProps {
  parishId?: string;
  memberId?: number | string;
  photoUrl?: string | null;
  memberName?: string;
  disabled?: boolean;
  onPhotoUploaded?: (photoUrl: string) => void;
  onPhotoRemoved?: () => void;
}

export const OfficerPhotoUploader: React.FC<OfficerPhotoUploaderProps> = ({
  parishId,
  memberId,
  photoUrl,
  memberName = '',
  disabled = false,
  onPhotoUploaded,
  onPhotoRemoved,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Helper to strictly ensure member has a genuine persistent numeric DB ID
  const isPersistedMember = (id: unknown): boolean => {
    if (typeof id === 'number' && Number.isInteger(id) && id > 0) return true;
    if (typeof id === 'string' && /^\d+$/.test(id.trim()) && Number.parseInt(id.trim(), 10) > 0) return true;
    return false;
  };

  const isSavedMember = Boolean(parishId && isPersistedMember(memberId));

  // Compute initials for avatar placeholder
  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return '?';
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const handleChooseFile = () => {
    if (disabled || uploading || removing || !isSavedMember) return;
    setErrorMessage(null);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so re-selecting the same file triggers onChange
    e.target.value = '';

    // Client-side validation: Max 2 MB
    const MAX_SIZE = 2 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMessage('Photo exceeds 2MB limit (JPEG, PNG, WebP only).');
      return;
    }

    // Client-side validation: MIME type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      setErrorMessage('Invalid format. Please select a JPEG, PNG, or WebP image.');
      return;
    }

    if (!parishId || !isSavedMember) {
      setErrorMessage('Please save this council member first before uploading a photo.');
      return;
    }

    setUploading(true);
    setErrorMessage(null);

    try {
      const result = await ParishCouncilService.uploadCouncilOfficerPhoto(
        parishId,
        String(memberId),
        file
      );
      if (onPhotoUploaded && result?.photoUrl) {
        onPhotoUploaded(result.photoUrl);
      }
    } catch (err: any) {
      console.error('[OfficerPhotoUploader] Upload error:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to upload photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (disabled || uploading || removing || !isSavedMember) return;
    setRemoving(true);
    setErrorMessage(null);

    try {
      await ParishCouncilService.removeCouncilOfficerPhoto(parishId!, String(memberId));
      if (onPhotoRemoved) {
        onPhotoRemoved();
      }
    } catch (err: any) {
      console.error('[OfficerPhotoUploader] Remove error:', err);
      setErrorMessage(err?.response?.data?.message || err?.message || 'Failed to remove photo.');
    } finally {
      setRemoving(false);
    }
  };

  const isBusy = uploading || removing;

  return (
    <div className="flex flex-col gap-1.5 flex-shrink-0">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
        disabled={disabled || isBusy || !isSavedMember}
        aria-label="Upload council officer photo"
      />

      <div className="flex items-center gap-2.5">
        {/* Avatar / Thumbnail */}
        <div className="relative w-11 h-11 rounded-full overflow-hidden border border-slate-200 bg-slate-100 flex items-center justify-center flex-shrink-0 shadow-xs">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={memberName || 'Officer'}
              className="w-full h-full object-cover object-center"
              onError={(e) => {
                // If broken image, fall back gracefully
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <span className="text-xs font-bold text-slate-500 uppercase select-none">
              {getInitials(memberName)}
            </span>
          )}

          {/* Busy Overlay Spinner */}
          {isBusy && (
            <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center text-white">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-1 text-[11px]">
          {!isSavedMember ? (
            <span
              className="text-[10px] font-medium text-slate-400 italic"
              title="Save council first to enable photo upload for new members"
            >
              Save member first
            </span>
          ) : isBusy ? (
            <span className="text-slate-500 flex items-center gap-1 font-semibold text-[10px]">
              <Loader2 size={11} className="animate-spin text-crimson-600" />
              {uploading ? 'Uploading...' : 'Removing...'}
            </span>
          ) : photoUrl ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleChooseFile}
                disabled={disabled || isBusy}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:text-crimson-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded transition-colors cursor-pointer disabled:opacity-50"
                title="Replace photo (JPEG, PNG, WebP <= 2MB)"
              >
                <RefreshCw size={11} />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={handleRemovePhoto}
                disabled={disabled || isBusy}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors cursor-pointer disabled:opacity-50"
                title="Remove photo"
              >
                <Trash2 size={11} />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleChooseFile}
              disabled={disabled || isBusy}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold text-crimson-700 bg-crimson-50 hover:bg-crimson-100 border border-crimson-200 rounded transition-colors cursor-pointer disabled:opacity-50"
              title="Upload photo (JPEG, PNG, WebP <= 2MB)"
            >
              <Camera size={11} />
              <span>Photo</span>
            </button>
          )}

          <span className="text-[9px] text-slate-400 leading-tight">
            JPEG/PNG/WebP, max 2MB
          </span>
        </div>
      </div>

      {/* Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-1 text-[10px] text-red-600 font-medium animate-in fade-in duration-150">
          <AlertCircle size={12} className="flex-shrink-0" />
          <span className="truncate max-w-[200px]" title={errorMessage}>
            {errorMessage}
          </span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-[9px] underline text-slate-400 hover:text-slate-600 ml-1"
          >
            x
          </button>
        </div>
      )}
    </div>
  );
};
