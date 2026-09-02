import type {
  CouncilMemberDraft,
  ParishCouncilConfig,
  SaveCouncilPayload,
} from '@/types';

export interface CouncilStateSnapshot {
  version: number;
  financeCouncilEnabled: boolean;
  pastoralCouncilMembers: CouncilMemberDraft[];
  financeCouncilMembers: CouncilMemberDraft[];
}

export function createFinanceDraftMember(): CouncilMemberDraft {
  return {
    id: `pfc-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    positionTitle: '',
    memberName: '',
  };
}

export function ensureFinanceDraftForEnabledState(
  enabled: boolean,
  members: CouncilMemberDraft[] = []
): CouncilMemberDraft[] {
  if (enabled && (!members || members.length === 0)) {
    return [createFinanceDraftMember()];
  }
  return members || [];
}

export function normalizeCouncilMembers(
  members: Array<{ positionTitle?: string; memberName?: string }> = []
): Array<{ positionTitle: string; memberName: string }> {
  if (!Array.isArray(members)) return [];
  return members.map((m) => ({
    positionTitle: (m?.positionTitle || '').trim(),
    memberName: (m?.memberName || '').trim(),
  }));
}

export function areCouncilSnapshotsEqual(
  a: {
    financeCouncilEnabled?: boolean;
    pastoralCouncilMembers?: Array<{ positionTitle?: string; memberName?: string }>;
    financeCouncilMembers?: Array<{ positionTitle?: string; memberName?: string }>;
  } | null | undefined,
  b: {
    financeCouncilEnabled?: boolean;
    pastoralCouncilMembers?: Array<{ positionTitle?: string; memberName?: string }>;
    financeCouncilMembers?: Array<{ positionTitle?: string; memberName?: string }>;
  } | null | undefined
): boolean {
  if (!a || !b) return false;
  if (Boolean(a.financeCouncilEnabled) !== Boolean(b.financeCouncilEnabled)) return false;

  const aPastoral = normalizeCouncilMembers(a.pastoralCouncilMembers);
  const bPastoral = normalizeCouncilMembers(b.pastoralCouncilMembers);
  if (aPastoral.length !== bPastoral.length) return false;
  for (let i = 0; i < aPastoral.length; i++) {
    if (
      aPastoral[i].positionTitle !== bPastoral[i].positionTitle ||
      aPastoral[i].memberName !== bPastoral[i].memberName
    ) {
      return false;
    }
  }

  const aFinance = normalizeCouncilMembers(a.financeCouncilMembers);
  const bFinance = normalizeCouncilMembers(b.financeCouncilMembers);
  if (aFinance.length !== bFinance.length) return false;
  for (let i = 0; i < aFinance.length; i++) {
    if (
      aFinance[i].positionTitle !== bFinance[i].positionTitle ||
      aFinance[i].memberName !== bFinance[i].memberName
    ) {
      return false;
    }
  }

  return true;
}

/**
 * Determines whether an ambiguous save (e.g. network failure after commit)
 * can be reconciled as successfully saved.
 *
 * Success requires BOTH:
 * 1. freshServerConfig.version === submittedExpectedVersion + 1
 * 2. Normalized server snapshot matches the expected submitted outcome.
 *
 * NOTE: When PFC is disabled (financeCouncilEnabled = false), backend preserves
 * existing finance rows, so expected server finance rows equal previous baseline rows.
 */
export function shouldReconcileAsSaved(
  submittedExpectedVersion: number,
  submittedPayload: SaveCouncilPayload,
  baselineSnapshot: CouncilStateSnapshot | null,
  freshServerConfig: ParishCouncilConfig
): boolean {
  // A. Version must have advanced by exactly 1
  if (freshServerConfig.version !== submittedExpectedVersion + 1) {
    return false;
  }

  // B. Server state must match the expected submitted snapshot
  const expectedServerSnapshot = {
    financeCouncilEnabled: submittedPayload.financeCouncilEnabled,
    pastoralCouncilMembers: normalizeCouncilMembers(submittedPayload.pastoralCouncilMembers),
    financeCouncilMembers: submittedPayload.financeCouncilEnabled
      ? normalizeCouncilMembers(submittedPayload.financeCouncilMembers)
      : normalizeCouncilMembers(baselineSnapshot?.financeCouncilMembers || []),
  };

  const actualServerSnapshot = {
    financeCouncilEnabled: freshServerConfig.financeCouncilEnabled,
    pastoralCouncilMembers: normalizeCouncilMembers(freshServerConfig.pastoralCouncilMembers),
    financeCouncilMembers: normalizeCouncilMembers(freshServerConfig.financeCouncilMembers),
  };

  return areCouncilSnapshotsEqual(expectedServerSnapshot, actualServerSnapshot);
}
