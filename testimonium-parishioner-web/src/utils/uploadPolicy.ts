export type UploadPolicyType = 'SUPPORTING_DOCUMENT' | 'AUTHORIZATION_LETTER' | 'CORRECTION_DOCUMENT' | 'REGISTRANT_ID_IMAGE';

export interface UploadPolicy {
  type: UploadPolicyType;
  allowedExtensions: string[];
  allowedMimes: string[];
  acceptAttribute: string;
  maxSizeBytes: number;
  label: string;
}

export const UPLOAD_POLICIES: Record<UploadPolicyType, UploadPolicy> = {
  SUPPORTING_DOCUMENT: {
    type: 'SUPPORTING_DOCUMENT',
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    acceptAttribute: '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
    maxSizeBytes: 5 * 1024 * 1024,
    label: 'PDF, JPG, PNG, or WebP — up to 5 MB',
  },
  AUTHORIZATION_LETTER: {
    type: 'AUTHORIZATION_LETTER',
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png'],
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'],
    acceptAttribute: '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png',
    maxSizeBytes: 5 * 1024 * 1024,
    label: 'PDF, JPG, or PNG — up to 5 MB',
  },
  CORRECTION_DOCUMENT: {
    type: 'CORRECTION_DOCUMENT',
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp'],
    allowedMimes: ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
    acceptAttribute: '.pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp',
    maxSizeBytes: 5 * 1024 * 1024,
    label: 'PDF, JPG, PNG, or WebP — up to 5 MB',
  },
  REGISTRANT_ID_IMAGE: {
    type: 'REGISTRANT_ID_IMAGE',
    allowedExtensions: ['.jpg', '.jpeg', '.png'],
    allowedMimes: ['image/jpeg', 'image/jpg', 'image/png'],
    acceptAttribute: '.jpg,.jpeg,.png,image/jpeg,image/png',
    maxSizeBytes: 5 * 1024 * 1024,
    label: 'JPG or PNG - up to 5 MB',
  },
};

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates a file against an upload policy.
 * - Allowed extension required
 * - If file.type is non-empty, requires compatible MIME
 * - Size <= maxSizeBytes (5 MB)
 * - Rejects 0-byte files
 * - Does NOT reject if browser reports empty MIME string but extension is valid
 */
export function validateUploadFile(file: File, policy: UploadPolicy): ValidationResult {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }

  // Reject 0-byte files cleanly
  if (file.size === 0) {
    return { valid: false, error: 'The selected file is empty (0 bytes). Please select a valid document.' };
  }

  // Size limit <= 5 MB
  if (file.size > policy.maxSizeBytes) {
    return { valid: false, error: `File is too large. Maximum size allowed is ${Math.round(policy.maxSizeBytes / (1024 * 1024))} MB.` };
  }

  const lowerName = file.name.toLowerCase();
  const hasValidExt = policy.allowedExtensions.some(ext => lowerName.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      error: `Unsupported file format. Accepted formats: ${policy.label}.`,
    };
  }

  // If File.type is non-empty, require compatible allowed MIME.
  // Do NOT reject an otherwise accepted document only because the browser reports an empty MIME string.
  if (file.type && file.type.trim() !== '') {
    const lowerType = file.type.toLowerCase().trim();
    if (!policy.allowedMimes.includes(lowerType)) {
      return {
        valid: false,
        error: `Unsupported file type (${file.type}). Accepted formats: ${policy.label}.`,
      };
    }
  }

  return { valid: true };
}
