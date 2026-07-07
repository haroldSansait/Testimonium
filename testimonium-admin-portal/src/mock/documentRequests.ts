import type { DocumentRequest } from '@/types';

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.toLocaleString(undefined, { month: 'short' });

export const documentRequests: DocumentRequest[] = [
  {
    id: 'doc-1',
    referenceNo: `REQ-${currentYear}-0892`,
    parishionerName: 'Maria Clara Santos',
    documentType: 'Baptismal Certificate',
    dateSubmitted: `${currentMonth} 07, ${currentYear}`,
    status: 'Pending Review',
  },
  {
    id: 'doc-2',
    referenceNo: `REQ-${currentYear}-0891`,
    parishionerName: 'Juan Dela Cruz',
    documentType: 'Marriage Certificate',
    dateSubmitted: `${currentMonth} 06, ${currentYear}`,
    status: 'Processing',
  },
  {
    id: 'doc-3',
    referenceNo: `REQ-${currentYear}-0888`,
    parishionerName: 'Elena Reyes',
    documentType: 'Confirmation Certificate',
    dateSubmitted: `${currentMonth} 04, ${currentYear}`,
    status: 'Ready for Pickup',
  },
  {
    id: 'doc-4',
    referenceNo: `REQ-${currentYear}-0885`,
    parishionerName: 'Carlos Mendoza',
    documentType: 'Good Moral Character',
    dateSubmitted: `${currentMonth} 03, ${currentYear}`,
    status: 'Released',
  },
  {
    id: 'doc-5',
    referenceNo: `REQ-${currentYear}-0882`,
    parishionerName: 'Jose Garcia',
    documentType: 'Baptismal Certificate',
    dateSubmitted: `${currentMonth} 02, ${currentYear}`,
    status: 'Rejected',
  },
  {
    id: 'doc-6',
    referenceNo: `REQ-${currentYear}-0880`,
    parishionerName: 'Ana Reyes',
    documentType: 'Marriage Certificate',
    dateSubmitted: `${currentMonth} 01, ${currentYear}`,
    status: 'Needs Correction',
  },
  {
    id: 'doc-7',
    referenceNo: `REQ-${currentYear}-0877`,
    parishionerName: 'Roberto Santos',
    documentType: 'Baptismal Certificate',
    dateSubmitted: `${currentMonth} 01, ${currentYear}`,
    status: 'Processing',
  },
  {
    id: 'doc-8',
    referenceNo: `REQ-${currentYear}-0875`,
    parishionerName: 'Lourdes Magno',
    documentType: 'Confirmation Certificate',
    dateSubmitted: `${currentMonth} 01, ${currentYear}`,
    status: 'Pending Review',
  },
];

export const totalDocumentRequests = 124;
