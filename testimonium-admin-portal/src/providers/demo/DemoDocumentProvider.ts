import type { DocumentProvider, DocumentRequestFilters } from '../interfaces';
import type { DocumentRequest, DocumentStatus } from '@/types';
import type { PaginatedResponse } from '@/types/api';
import { documentRequests } from '@/mock/documentRequests';

// Stateful in-memory list to track document request status updates.
let store: DocumentRequest[] = documentRequests.map(r => ({
  ...r,
  purpose: r.documentType === 'Baptismal Certificate' ? 'Marriage Requirement' : 'Personal Copy',
  paymentStatus: r.status === 'Released' || r.status === 'Ready for Pickup' ? 'Paid' : 'Unpaid',
  requirements: ['Valid ID', 'Proof of Parish Registration'],
  timeline: [
    { status: 'Pending Review', date: r.dateSubmitted, note: 'Request received and queued.' },
    ...(r.status !== 'Pending Review' && r.status !== 'Needs Correction' && r.status !== 'Rejected' ? [{ status: 'Processing', date: r.dateSubmitted, note: 'Documents are being prepared.' }] : []),
    ...(r.status === 'Ready for Pickup' || r.status === 'Released' ? [{ status: 'Ready for Pickup', date: r.dateSubmitted, note: 'Ready for collection at parish office.' }] : []),
    ...(r.status === 'Released' ? [{ status: 'Released', date: r.dateSubmitted, note: 'Document collected by applicant.' }] : []),
    ...(r.status === 'Rejected' ? [{ status: 'Rejected', date: r.dateSubmitted, note: 'Incomplete documents.' }] : []),
    ...(r.status === 'Needs Correction' ? [{ status: 'Needs Correction', date: r.dateSubmitted, note: 'Corrections requested.' }] : []),
  ]
}));

export const DemoDocumentProvider: DocumentProvider = {
  async getDocumentRequests(filters: DocumentRequestFilters = {}): Promise<PaginatedResponse<DocumentRequest>> {
    const { search = '', documentType = 'all', status = 'all', page = 1, pageSize = 5 } = filters;
    let result = [...store];

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.referenceNo.toLowerCase().includes(q) ||
          r.parishionerName.toLowerCase().includes(q)
      );
    }
    if (documentType !== 'all') {
      result = result.filter((r) => r.documentType === documentType);
    }
    if (status !== 'all') {
      result = result.filter((r) => r.status === status);
    }

    const total = result.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedData = result.slice(startIndex, startIndex + pageSize);
    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    };
  },

  async updateDocumentStatus(id: string, status: DocumentStatus): Promise<DocumentRequest> {
    store = store.map(r => {
      if (r.id !== id) return r;
      
      const newTimeline = [...(r.timeline || [])];
      const todayStr = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      newTimeline.push({
        status,
        date: todayStr,
        note: `Status changed to ${status}.`
      });

      return {
        ...r,
        status,
        paymentStatus: status === 'Ready for Pickup' || status === 'Released' ? 'Paid' : r.paymentStatus,
        timeline: newTimeline
      };
    });

    const updated = store.find(r => r.id === id);
    if (!updated) throw new Error(`Document request ${id} not found`);
    return updated;
  }
};
