import type { DocumentRequest } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

interface DocumentRequestTableProps {
  requests: DocumentRequest[];
}

export function DocumentRequestTable({ requests }: DocumentRequestTableProps) {
  if (requests.length === 0) {
    return <EmptyState title="No document requests" description="No requests match your current search or filter." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Reference No.</th>
            <th>Parishioner Name</th>
            <th>Document Type</th>
            <th>Date Submitted</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map((req) => (
            <tr key={req.id} className="transition-colors">
              <td className="font-semibold text-gray-900 whitespace-nowrap">{req.referenceNo}</td>
              <td className="text-gray-700">{req.parishionerName}</td>
              <td className="text-gray-600">{req.documentType}</td>
              <td className="text-gray-600 whitespace-nowrap">{req.dateSubmitted}</td>
              <td>
                <StatusBadge status={req.status} />
              </td>
              <td>
                <button
                  className="text-sm font-medium text-crimson-700 hover:text-crimson-800 hover:underline transition-colors whitespace-nowrap"
                  id={`view-doc-${req.id}`}
                  aria-label={`View details for ${req.referenceNo}`}
                >
                  View Details
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
