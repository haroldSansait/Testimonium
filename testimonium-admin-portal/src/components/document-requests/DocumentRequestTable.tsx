import type { DocumentRequest } from '@/types';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';

interface DocumentRequestTableProps {
  requests: DocumentRequest[];
  onViewDetails?: (req: DocumentRequest) => void;
}

export function DocumentRequestTable({ requests, onViewDetails }: DocumentRequestTableProps) {
  if (requests.length === 0) {
    return <EmptyState title="No document requests" description="No requests match your current search or filter." />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr className="bg-gray-50/80 text-gray-700 text-xs uppercase tracking-wider">
            <th className="py-3 px-4 text-left font-semibold">Reference No.</th>
            <th className="py-3 px-4 text-left font-semibold">Parishioner & Relationship</th>
            <th className="py-3 px-4 text-left font-semibold">Document Type</th>
            <th className="py-3 px-4 text-left font-semibold">Date Submitted</th>
            <th className="py-3 px-4 text-left font-semibold">Status</th>
            <th className="py-3 px-4 text-right font-semibold">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-xs">
          {requests.map((req) => (
            <tr key={req.id} className="hover:bg-gray-50/70 transition-colors">
              <td className="py-3 px-4 font-mono font-semibold text-gray-900 whitespace-nowrap">{req.referenceNo}</td>
              <td className="py-3 px-4 text-gray-800 font-medium">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span>{req.parishionerName}</span>
                  {req.relationship && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${
                      req.relationship === 'Self'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                    }`}>
                      {req.relationship}
                    </span>
                  )}
                </div>
              </td>
              <td className="py-3 px-4 text-gray-700">{req.documentType}</td>
              <td className="py-3 px-4 text-gray-500 whitespace-nowrap">{req.dateSubmitted}</td>
              <td className="py-3 px-4">
                <StatusBadge status={req.status} />
              </td>
              <td className="py-3 px-4 text-right">
                <button
                  onClick={() => onViewDetails?.(req)}
                  className="px-2.5 py-1 text-xs font-semibold text-crimson hover:text-crimson/80 hover:bg-red-50 rounded transition-colors whitespace-nowrap cursor-pointer focus:ring-1 focus:ring-crimson"
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
