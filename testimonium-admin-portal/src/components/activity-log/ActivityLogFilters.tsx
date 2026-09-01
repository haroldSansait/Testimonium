import { Calendar, Shield, Filter, Eye } from 'lucide-react';
import { CustomSelect } from '@/components/ui/CustomSelect';

interface ActivityLogFiltersProps {
  dateRange: string;
  onDateRangeChange: (value: string) => void;
  role: string;
  onRoleChange: (value: string) => void;
  actionType: string;
  onActionTypeChange: (value: string) => void;
  actionTypeOptions: string[];
  status: 'All' | 'Active' | 'Archived';
  onStatusChange: (value: 'All' | 'Active' | 'Archived') => void;
}

const roleOptions = ['All Roles', 'Diocese Coordinator', 'Priest', 'Secretary'];
const statusOptions = [
  { value: 'Active', label: 'Active Logs' },
  { value: 'Archived', label: 'Archived Logs' },
  { value: 'All', label: 'All Logs' },
];

export function ActivityLogFilters({
  dateRange,
  onDateRangeChange,
  role,
  onRoleChange,
  actionType,
  onActionTypeChange,
  actionTypeOptions,
  status,
  onStatusChange,
}: ActivityLogFiltersProps) {
  const now = new Date();
  const year = now.getFullYear();
  const monthName = now.toLocaleString('en-US', { month: 'short' });
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  const dynamicPlaceholder = `${monthName} 1, ${year} - ${monthName} ${lastDay}, ${year}`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Date Range */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Date Range</label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={dateRange}
              onChange={(e) => onDateRangeChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all bg-white shadow-xs"
              placeholder={dynamicPlaceholder}
            />
          </div>
        </div>

        {/* Role */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Role</label>
          <CustomSelect
            value={role}
            onChange={onRoleChange}
            options={roleOptions}
            placeholder="Select role..."
            icon={<Shield className="w-4 h-4" />}
          />
        </div>

        {/* Action Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Action Type</label>
          <CustomSelect
            value={actionType}
            onChange={onActionTypeChange}
            options={actionTypeOptions}
            placeholder="Select action..."
            icon={<Filter className="w-4 h-4" />}
          />
        </div>

        {/* Status (Archive Filter) */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 mb-1.5">Log Status</label>
          <CustomSelect
            value={status}
            onChange={(val) => onStatusChange(val as 'All' | 'Active' | 'Archived')}
            options={statusOptions}
            placeholder="Select status..."
            icon={<Eye className="w-4 h-4" />}
          />
        </div>
      </div>
    </div>
  );
}
