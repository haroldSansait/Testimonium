/**
 * Government ID Verification Configuration
 *
 * Supported Philippine Government-Issued Card IDs:
 * - PhilSys / National ID
 * - Driver's License
 * - UMID (Unified Multi-Purpose ID)
 * - Voter ID
 * - Postal ID
 *
 * Passport, Student ID, and Company ID are explicitly excluded.
 */

export const GOVERNMENT_ID_STATUS = Object.freeze({
  NOT_SUBMITTED: "NOT_SUBMITTED",
  VERIFIED: "VERIFIED",
  REJECTED: "REJECTED",
});

export const GOVERNMENT_ID_REJECTION_REASONS = Object.freeze({
  IMAGE_BLURRY: "IMAGE_BLURRY",
  FRONT_BACK_INCOMPLETE: "FRONT_BACK_INCOMPLETE",
  NAME_MISMATCH: "NAME_MISMATCH",
  ID_EXPIRED: "ID_EXPIRED",
  UNSUPPORTED_OR_INVALID_DOCUMENT: "UNSUPPORTED_OR_INVALID_DOCUMENT",
});

// Safe machine-readable infrastructure codes that the HTTP layer may expose.
// Human-readable 5xx details remain hidden by the global error handler.
export const GOVERNMENT_ID_INFRASTRUCTURE_ERROR_CODES = Object.freeze({
  IDENTITY_STORAGE_UNAVAILABLE: "IDENTITY_STORAGE_UNAVAILABLE",
  OCR_SERVICE_UNAVAILABLE: "OCR_SERVICE_UNAVAILABLE",
  OCR_PROVIDER_UNAVAILABLE: "OCR_PROVIDER_UNAVAILABLE",
  OCR_UPSTREAM_ERROR: "OCR_UPSTREAM_ERROR",
  OCR_TIMEOUT_OR_UNAVAILABLE: "OCR_TIMEOUT_OR_UNAVAILABLE",
  STORAGE_ERROR: "STORAGE_ERROR",
  IDENTITY_PERSISTENCE_ERROR: "IDENTITY_PERSISTENCE_ERROR",
});

export const REJECTION_MESSAGES = Object.freeze({
  IMAGE_BLURRY: "The uploaded ID image is blurry or unreadable. Please ensure the card is in focus with good lighting.",
  FRONT_BACK_INCOMPLETE: "Both the front and back of the Government ID are required and must be distinct images.",
  NAME_MISMATCH: "The name on the Government ID does not match your profile name. Please make sure your profile name reflects your legal name on the card.",
  ID_EXPIRED: "The submitted Government ID has expired. Please provide a currently valid, unexpired Government ID.",
  UNSUPPORTED_OR_INVALID_DOCUMENT: "The uploaded document is not a supported Philippine Government ID card. Supported IDs: PhilSys / National ID, Driver's License, UMID, Voter's ID, and Postal ID.",
});

export const getRejectionMessage = (reasonCode) => {
  return REJECTION_MESSAGES[reasonCode] || "The Government ID could not be verified. Please try again with a clear, valid ID.";
};

export const SUPPORTED_GOVERNMENT_IDS = Object.freeze({
  PHIL_SYS: {
    idType: "PHIL_SYS",
    displayName: "PhilSys / National ID",
    hasExpiry: false,
    frontMarkers: [
      {
        description: "National / Republic Header",
        pattern: /REPUBLIKA\s+NG\s+PILIPINAS|REPUBLIC\s+OF\s+THE\s+PHILIPPINES|PILIPINAS/i,
      },
      {
        description: "PhilSys Identifier",
        pattern: /PHILIPPINE\s+IDENTIFICATION\s+SYSTEM|PHILSYS|PAMBANSANG\s+PAGKAKAKILANLAN|PHILIPPINE\s+IDENTIFICATION\s+CARD/i,
      },
    ],
    backMarkers: [
      {
        description: "PSA Issuing Authority",
        pattern: /PHILIPPINE\s+STATISTICS\s+AUTHORITY/i,
        strength: "STRONG",
      },
      {
        description: "Issuance Date Label",
        pattern: /DATE\s+OF\s+ISSUANCE/i,
        strength: "STRONG",
      },
      {
        description: "Shared PhilSys Terms",
        pattern: /PSA|PAMBANSANG\s+PAGKAKAKILANLAN/i,
        strength: "SHARED",
      },
    ],
  },
  DRIVERS_LICENSE: {
    idType: "DRIVERS_LICENSE",
    displayName: "Driver's License",
    hasExpiry: true,
    frontMarkers: [
      {
        description: "LTO Header",
        pattern: /LAND\s+TRANSPORTATION\s+OFFICE|LTO/i,
      },
      {
        description: "Driver License Identifier",
        pattern: /DRIVER'?S\s+LICENSE|NON-?PROFESSIONAL\s+DRIVER|PROFESSIONAL\s+DRIVER|DL\s+NO/i,
      },
    ],
    backMarkers: [
      {
        description: "Organ Donor or Blood Type",
        pattern: /ORGAN\s+DONOR|BLOOD\s+TYPE/i,
        strength: "STRONG",
      },
      {
        description: "Conditions Label",
        pattern: /CONDITIONS/i,
        strength: "SUPPORTING",
      },
      {
        description: "Restrictions Label",
        pattern: /RESTRICTIONS/i,
        strength: "SUPPORTING",
      },
      {
        description: "Shared LTO Term",
        pattern: /LTO/i,
        strength: "SHARED",
      },
    ],
  },
  UMID: {
    idType: "UMID",
    displayName: "Unified Multi-Purpose ID (UMID)",
    hasExpiry: false,
    frontMarkers: [
      {
        description: "UMID Identifier",
        pattern: /UNIFIED\s+MULTI-?PURPOSE\s+ID|UMID/i,
      },
      {
        description: "Republic or Agency Identifier",
        pattern: /REPUBLIC\s+OF\s+THE\s+PHILIPPINES|SOCIAL\s+SECURITY\s+SYSTEM|GSIS|CRN|COMMON\s+REFERENCE\s+NUMBER/i,
      },
    ],
    backMarkers: [
      {
        description: "PhilHealth Agency Marker",
        pattern: /PHILHEALTH/i,
        strength: "STRONG",
      },
      {
        description: "Pag-IBIG Agency Marker",
        pattern: /PAG-?IBIG/i,
        strength: "STRONG",
      },
      {
        description: "Shared SSS or GSIS Terms",
        pattern: /SOCIAL\s+SECURITY\s+SYSTEM|GSIS/i,
        strength: "SHARED",
      },
    ],
  },
  VOTER_ID: {
    idType: "VOTER_ID",
    displayName: "Voter's ID",
    hasExpiry: false,
    frontMarkers: [
      {
        description: "COMELEC Header",
        pattern: /COMMISSION\s+ON\s+ELECTIONS|COMELEC/i,
      },
      {
        description: "Voter ID Identifier",
        pattern: /VOTER'?S\s+IDENTIFICATION\s+CARD|VOTER'?S\s+ID|VOTER\s+ID|PRECINCT/i,
      },
    ],
    backMarkers: [
      {
        description: "Chairman Label",
        pattern: /CHAIRMAN/i,
        strength: "SUPPORTING",
      },
      {
        description: "Shared Republic or COMELEC Terms",
        pattern: /REPUBLIC\s+OF\s+THE\s+PHILIPPINES|COMMISSION\s+ON\s+ELECTIONS|COMELEC/i,
        strength: "SHARED",
      },
    ],
  },
  POSTAL_ID: {
    idType: "POSTAL_ID",
    displayName: "Postal ID",
    hasExpiry: true,
    frontMarkers: [
      {
        description: "PhilPost Header",
        pattern: /PHILIPPINE\s+POSTAL\s+CORPORATION|PHLPOST|PHILPOST/i,
      },
      {
        description: "Postal ID Identifier",
        pattern: /POSTAL\s+ID|POSTAL\s+IDENTITY\s+CARD|IDENTITY\s+CARD/i,
      },
    ],
    backMarkers: [
      {
        description: "Postmaster Marker",
        pattern: /POSTMASTER/i,
        strength: "STRONG",
      },
      {
        description: "Shared Postal Terms",
        pattern: /PHILPOST|PHLPOST|POSTAL/i,
        strength: "SHARED",
      },
    ],
  },
});
