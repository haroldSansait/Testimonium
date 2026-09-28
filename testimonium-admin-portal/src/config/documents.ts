/**
 * Canonical Document Configuration for Admin Portal
 * Mirrors backend authoritative definition in config/documents.js
 */

export interface CanonicalDocumentDefinition {
  id: string;
  label: string;
  defaultPrice: number;
  description: string;
  requirements: Array<{ id: string; label: string }>;
}

export const CANONICAL_DOCUMENT_TYPES: CanonicalDocumentDefinition[] = [
  {
    id: 'BAPTISMAL_CERTIFICATE',
    label: 'Baptismal Certificate',
    defaultPrice: 100,
    description: 'Official copy of the Sacrament of Baptism registry entry.',
    requirements: [{ id: 'valid_id', label: 'Valid ID' }],
  },
  {
    id: 'CONFIRMATION_CERTIFICATE',
    label: 'Confirmation Certificate',
    defaultPrice: 100,
    description: 'Official record of the Sacrament of Confirmation.',
    requirements: [{ id: 'valid_id', label: 'Valid ID' }],
  },
  {
    id: 'MARRIAGE_CERTIFICATE',
    label: 'Marriage Certificate',
    defaultPrice: 150,
    description: 'Official sacramental record of Holy Matrimony.',
    requirements: [{ id: 'valid_id', label: 'Valid ID' }],
  },
  {
    id: 'FIRST_COMMUNION_CERTIFICATE',
    label: 'First Communion Certificate',
    defaultPrice: 75,
    description: 'Official record of First Holy Communion.',
    requirements: [{ id: 'valid_id', label: 'Valid ID' }],
  },
  {
    id: 'MARRIAGE_BANNS',
    label: 'Marriage Banns',
    defaultPrice: 200,
    description: 'Public notification of prospective marriage posted across parishes.',
    requirements: [
      { id: 'valid_id', label: 'Valid ID' },
      { id: 'baptismal_cert', label: 'Baptismal Certificate' },
      { id: 'confirmation_cert', label: 'Confirmation Certificate' },
      { id: 'marriage_license', label: 'Civil Marriage License' },
      { id: 'precana_proof', label: 'Pre-Cana Seminar Certificate' },
      { id: 'cenomar', label: 'PSA CENOMAR' },
      { id: 'banns_clearance', label: 'Banns Clearance Form' },
    ],
  },
  {
    id: 'PERMIT_TO_MARRY',
    label: 'Permit to Marry',
    defaultPrice: 150,
    description: 'Canonical clearance granted to marry in another parish or jurisdiction.',
    requirements: [
      { id: 'valid_id', label: 'Valid Government ID' },
      { id: 'baptismal_cert', label: 'Baptismal Certificate' },
      { id: 'confirmation_cert', label: 'Confirmation Certificate' },
      { id: 'marriage_license', label: 'Civil Marriage License' },
      { id: 'precana_proof', label: 'Pre-Cana Seminar Certificate' },
      { id: 'cenomar', label: 'PSA CENOMAR' },
      { id: 'canonical_interview', label: 'Canonical Interview Form' },
      { id: 'banns_clearance', label: 'Banns Clearance' },
    ],
  },
  {
    id: 'STATUS_OF_LIBERTY',
    label: 'Status of Liberty Certificate',
    defaultPrice: 150,
    description: 'Attestation of canonical freedom to marry (Status Liber).',
    requirements: [
      { id: 'valid_id', label: 'Valid Government ID' },
      { id: 'baptismal_cert', label: 'Baptismal Certificate' },
      { id: 'cenomar', label: 'PSA CENOMAR' },
      { id: 'canonical_interview', label: 'Canonical Interview Document' },
    ],
  },
];

export const CANONICAL_DOCUMENT_IDS = CANONICAL_DOCUMENT_TYPES.map((d) => d.id);
export const DEFAULT_OFFERED_DOCUMENTS = [...CANONICAL_DOCUMENT_IDS];

export interface CanonicalRequirement {
  id: string;
  label: string;
}

export const CANONICAL_REQUIREMENTS: CanonicalRequirement[] = Array.from(
  new Map(
    CANONICAL_DOCUMENT_TYPES.flatMap((doc) => doc.requirements)
      .map((requirement) => [requirement.id, requirement] as const)
  ).values()
);

export const DEFAULT_REQUIREMENTS_PER_DOC: Record<string, string[]> = Object.fromEntries(
  CANONICAL_DOCUMENT_TYPES.map((doc) => [doc.id, doc.requirements.map((r) => r.id)])
);

export function getAssignedCanonicalRequirements(docId: string, documentSettings: any) {
  const conf = documentSettings?.[docId] || {};
  const reqs = conf.requirements || {};
  const defaults = DEFAULT_REQUIREMENTS_PER_DOC[docId] || [];

  return CANONICAL_REQUIREMENTS.filter((requirement) => {
    if (reqs[requirement.id] !== undefined) {
      return reqs[requirement.id] === true;
    }
    return defaults.includes(requirement.id);
  });
}

export function getAvailableCanonicalRequirements(docId: string, documentSettings: any) {
  const assignedIds = new Set(
    getAssignedCanonicalRequirements(docId, documentSettings).map((requirement) => requirement.id)
  );
  return CANONICAL_REQUIREMENTS.filter((requirement) => !assignedIds.has(requirement.id));
}

export function setCanonicalRequirementAssignment(
  documentSettings: any,
  docId: string,
  requirementId: string,
  assigned: boolean
) {
  if (!CANONICAL_REQUIREMENTS.some((requirement) => requirement.id === requirementId)) {
    throw new Error(`Unknown canonical requirement: ${requirementId}`);
  }

  const doc = documentSettings?.[docId] || { price: 0, requirements: {} };
  return {
    ...documentSettings,
    [docId]: {
      ...doc,
      requirements: {
        ...(doc.requirements || {}),
        [requirementId]: assigned,
      },
    },
  };
}
