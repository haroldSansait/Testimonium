import type { DocumentRequest } from '@/types';

export const documentRequests: DocumentRequest[] = [
  {
    id: 'doc-1',
    referenceNo: 'REQ-2023-0892',
    parishionerName: 'Maria Clara Santos',
    documentType: 'Baptismal Certificate',
    dateSubmitted: 'Oct 24, 2023',
    status: 'Pending Review',
  },
  {
    id: 'doc-2',
    referenceNo: 'REQ-2023-0891',
    parishionerName: 'Juan Dela Cruz',
    documentType: 'Marriage Certificate',
    dateSubmitted: 'Oct 23, 2023',
    status: 'Processing',
  },
  {
    id: 'doc-3',
    referenceNo: 'REQ-2023-0888',
    parishionerName: 'Elena Reyes',
    documentType: 'Confirmation Certificate',
    dateSubmitted: 'Oct 20, 2023',
    status: 'Ready for Pickup',
  },
  {
    id: 'doc-4',
    referenceNo: 'REQ-2023-0885',
    parishionerName: 'Carlos Mendoza',
    documentType: 'Good Moral Character',
    dateSubmitted: 'Oct 18, 2023',
    status: 'Released',
  },
  {
    id: 'doc-5',
    referenceNo: 'REQ-2023-0882',
    parishionerName: 'Jose Garcia',
    documentType: 'Baptismal Certificate',
    dateSubmitted: 'Oct 15, 2023',
    status: 'Rejected',
  },
  {
    id: 'doc-6',
    referenceNo: 'REQ-2023-0880',
    parishionerName: 'Ana Reyes',
    documentType: 'Marriage Certificate',
    dateSubmitted: 'Oct 12, 2023',
    status: 'Needs Correction',
  },
  {
    id: 'doc-7',
    referenceNo: 'REQ-2023-0877',
    parishionerName: 'Roberto Santos',
    documentType: 'Baptismal Certificate',
    dateSubmitted: 'Oct 10, 2023',
    status: 'Processing',
  },
  {
    id: 'doc-8',
    referenceNo: 'REQ-2023-0875',
    parishionerName: 'Lourdes Magno',
    documentType: 'Confirmation Certificate',
    dateSubmitted: 'Oct 8, 2023',
    status: 'Pending Review',
  },
];

export const totalDocumentRequests = 124;
