/**
 * Canonical Document Configuration for Parishioner Web
 * Mirrors backend authoritative definition in config/documents.js
 */

export interface CanonicalDocumentDefinition {
  id: string;
  type: string;
  title: string;
  label: string;
  desc: string;
  defaultPrice: number;
}

export const CANONICAL_DOCUMENT_TYPES: CanonicalDocumentDefinition[] = [
  {
    id: 'BAPTISMAL_CERTIFICATE',
    type: 'BAPTISMAL_CERTIFICATE',
    title: 'Baptismal Certificate',
    label: 'Baptismal Certificate',
    desc: 'Official copy of the Sacrament of Baptism registry entry',
    defaultPrice: 100,
  },
  {
    id: 'CONFIRMATION_CERTIFICATE',
    type: 'CONFIRMATION_CERTIFICATE',
    title: 'Confirmation Certificate',
    label: 'Confirmation Certificate',
    desc: 'Official record of the Sacrament of Confirmation',
    defaultPrice: 100,
  },
  {
    id: 'MARRIAGE_CERTIFICATE',
    type: 'MARRIAGE_CERTIFICATE',
    title: 'Marriage Certificate',
    label: 'Marriage Certificate',
    desc: 'Official ecclesial record of Holy Matrimony',
    defaultPrice: 150,
  },
  {
    id: 'FIRST_COMMUNION_CERTIFICATE',
    type: 'FIRST_COMMUNION_CERTIFICATE',
    title: 'First Communion Certificate',
    label: 'First Communion Certificate',
    desc: 'Official record of First Holy Communion',
    defaultPrice: 75,
  },
  {
    id: 'MARRIAGE_BANNS',
    type: 'MARRIAGE_BANNS',
    title: 'Marriage Banns',
    label: 'Marriage Banns',
    desc: 'Public notification of prospective marriage posted across parishes',
    defaultPrice: 200,
  },
  {
    id: 'PERMIT_TO_MARRY',
    type: 'PERMIT_TO_MARRY',
    title: 'Permit to Marry',
    label: 'Permit to Marry',
    desc: 'Canonical clearance granted to marry in another parish or jurisdiction',
    defaultPrice: 150,
  },
  {
    id: 'STATUS_OF_LIBERTY',
    type: 'STATUS_OF_LIBERTY',
    title: 'Status of Liberty',
    label: 'Status of Liberty Certificate',
    desc: 'Attestation of canonical freedom to marry (Status Liber)',
    defaultPrice: 150,
  },
];

export const CANONICAL_DOCUMENT_IDS = CANONICAL_DOCUMENT_TYPES.map((d) => d.id);
export const DEFAULT_OFFERED_DOCUMENTS = [...CANONICAL_DOCUMENT_IDS];
