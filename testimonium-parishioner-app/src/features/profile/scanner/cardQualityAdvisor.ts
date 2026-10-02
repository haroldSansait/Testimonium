export interface CapturedImageMetrics {
  uri: string;
  width?: number;
  height?: number;
}

export interface QualityAdvisoryResult {
  passed: boolean;
  warning?: string;
}

/**
 * Lightweight client-side advisory checks on captured photo.
 * Advisory only — backend remains the ultimate authority for OCR, sharpness, and validity.
 */
export function checkCapturedImageQuality(
  image: CapturedImageMetrics | null | undefined
): QualityAdvisoryResult {
  if (!image || !image.uri) {
    return {
      passed: false,
      warning: "No image was captured. Please try again.",
    };
  }

  // If dimensions are provided by camera preview / capture
  if (image.width && image.height) {
    // Check minimum usable resolution (at least 480px width)
    if (image.width < 400 || image.height < 250) {
      return {
        passed: false,
        warning: "Captured image resolution appears too low. Please hold closer.",
      };
    }

    // Expected landscape orientation
    const isLandscape = image.width >= image.height;
    if (!isLandscape && image.height / image.width > 1.35) {
      return {
        passed: false,
        warning: "Please hold your ID in landscape orientation.",
      };
    }
  }

  return {
    passed: true,
  };
}
