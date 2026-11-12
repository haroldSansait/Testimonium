import { normalizeNameText } from "./governmentIdNameMatcher.js";

export const GOOGLE_LEGAL_NAME_ACTIVITY_INCLUDE = {
  where: {
    OR: [
      { action: "Google New User" },
      { action: "Profile Updated", metadata: { contains: "legalNameConfirmed" } },
    ],
  },
  select: {
    action: true,
    metadata: true,
    createdAt: true,
  },
  orderBy: { createdAt: "desc" },
  take: 5,
};

export function parseActivityMetadata(metadata) {
  if (!metadata) return null;
  if (typeof metadata === "object") return metadata;
  if (typeof metadata !== "string") return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

export function hasConfirmedStructuredName(user) {
  return Boolean(
    typeof user?.firstName === "string" &&
      user.firstName.trim() &&
      typeof user?.lastName === "string" &&
      user.lastName.trim()
  );
}

/**
 * Determines whether a parishioner account is a newly registered Google account
 * that still needs legal-name confirmation on the Profile page.
 * Legacy accounts (including existing Google accounts with NULL structured names)
 * do not carry the registration confirmation marker and are never flagged.
 */
export function needsGoogleLegalNameConfirmation(user) {
  if (!user) return false;
  const roleName = user.role?.roleName || user.role;
  if (roleName !== "PARISHIONER") return false;
  if (user.governmentIdVerification?.status === "VERIFIED") return false;
  if (hasConfirmedStructuredName(user)) return false;

  const logs = Array.isArray(user.activityLogs) ? user.activityLogs : [];
  const hasConfirmationLog = logs.some((log) => {
    if (log?.action !== "Profile Updated") return false;
    const meta = parseActivityMetadata(log.metadata);
    return meta?.legalNameConfirmed === true;
  });
  if (hasConfirmationLog) return false;

  return logs.some((log) => {
    if (log?.action !== "Google New User") return false;
    const meta = parseActivityMetadata(log.metadata);
    return meta?.legalNameConfirmationRequired === true;
  });
}

export function doesConfirmedNameMatchDisplayedName(displayedFullName, reconstructedFullName) {
  const normalizedDisplayed = normalizeNameText(displayedFullName);
  const normalizedReconstructed = normalizeNameText(reconstructedFullName);
  return Boolean(normalizedDisplayed && normalizedDisplayed === normalizedReconstructed);
}

