import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Pagination } from '@/components/ui/Pagination';
import { DocumentRequestTable } from '@/components/document-requests/DocumentRequestTable';
import { getDocumentRequests } from '@/services/documentRequestService';
import type { DocumentRequest, DocumentStatus, DocumentType } from '@/types';

const DOCUMENT_TYPE_OPTIONS: { label: string; value: DocumentType | 'all' }[] = [
  { label: 'All Document Types', value: 'all' },
  { label: 'Baptismal Certificate', value: 'Baptismal Certificate' },
  { label: 'Marriage Certificate', value: 'Marriage Certificate' },
  { label: 'Confirmation Certificate', value: 'Confirmation Certificate' },
  { label: 'Good Moral Character', value: 'Good Moral Character' },
  { label: 'Death Certificate', value: 'Death Certificate' },
];

const STATUS_OPTIONS: { label: string; value: DocumentStatus | 'all' }[] = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Pending Review', value: 'Pending Review' },
  { label: 'Processing', value: 'Processing' },
  { label: 'Ready for Pickup', value: 'Ready for Pickup' },
  { label: 'Released', value: 'Released' },
  { label: 'Rejected', value: 'Rejected' },
  { label: 'Needs Correction', value: 'Needs Correction' },
];

export function DocumentRequestsPage() {
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState<DocumentType | 'all'>('all');
  const [status, setStatus] = useState<DocumentStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const PAGE_SIZE = 5;

  const fetchRequests = useCallback(async () => {
    const result = await getDocumentRequests({ search, documentType, status, page, pageSize: PAGE_SIZE });
    setRequests(result.data);
    setTotal(result.total);
    setTotalPages(result.totalPages);
  }, [search, documentType, status, page]);

  useEffect(() => {
    void fetchRequests();
  }, [fetchRequests]);

  // Reset page on filter change
  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleType = (v: string) => { setDocumentType(v as DocumentType | 'all'); setPage(1); };
  const handleStatus = (v: string) => { setStatus(v as DocumentStatus | 'all'); setPage(1); };

  return (
    <div>
      <PageHeader
        title="Document Requests"
        subtitle="Manage and process parishioner requests for official certificates and documents."
      />

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            placeholder="Search by Reference No. or Name..."
            value={search}
            onChange={handleSearch}
            className="flex-1"
          />
          <div className="flex gap-3">
            {/* Document Type filter */}
            <div className="relative">
              <select
                value={documentType}
                onChange={(e) => handleType(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[180px]"
                id="filter-document-type"
                aria-label="Filter by document type"
              >
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => handleStatus(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[140px]"
                id="filter-status"
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Table Card */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <DocumentRequestTable requests={requests} />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
