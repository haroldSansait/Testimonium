import { Calendar, Users, Filter } from 'lucide-react';

interface ActivityLogFiltersProps {
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  personnel: string;
  onPersonnelChange: (value: string) => void;
  actionType: string;
  onActionTypeChange: (value: string) => void;
}

const personnelOptions = ['All Personnel', 'Father Michael', 'Sister Theresa', 'John Doe'];
const actionTypeOptions = ['All Actions', 'Validated', 'Under Review', 'Rejected', 'Approved'];

export function ActivityLogFilters({
  dateRange,
  onDateRangeChange,
  personnel,
  onPersonnelChange,
  actionType,
  onActionTypeChange,
}: ActivityLogFiltersProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date Range</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={dateRange}
              onChange={(e) => onDateRangeChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all bg-white"
              placeholder="Oct 1, 2023 - Oct 31, 2023"
            />
          </div>
        </div>

        {/* Personnel */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Personnel</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={personnel}
              onChange={(e) => onPersonnelChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all bg-white appearance-none cursor-pointer"
            >
              {personnelOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Action Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Action Type</label>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <select
              value={actionType}
              onChange={(e) => onActionTypeChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all bg-white appearance-none cursor-pointer"
            >
              {actionTypeOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
