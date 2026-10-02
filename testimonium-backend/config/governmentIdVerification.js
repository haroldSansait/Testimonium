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
      /PHILIPPINE\s+STATISTICS\s+AUTHORITY|PSA|PAMBANSANG\s+PAGKAKAKILANLAN|DATE\s+OF\s+ISSUANCE/i,
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
      /CONDITIONS|RESTRICTIONS|ORGAN\s+DONOR|BLOOD\s+TYPE|LTO/i,
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
      /SOCIAL\s+SECURITY\s+SYSTEM|GSIS|PHILHEALTH|PAG-?IBIG/i,
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
      /REPUBLIC\s+OF\s+THE\s+PHILIPPINES|COMMISSION\s+ON\s+ELECTIONS|COMELEC|CHAIRMAN/i,
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
      /POSTMASTER|PHILPOST|PHLPOST|POSTAL/i,
    ],
  },
});
