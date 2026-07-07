import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Info, FileWarning } from 'lucide-react';
import type { RecentAlert } from '@/types';
import { cn } from '@/utils/cn';

interface AlertItemProps {
  alert: RecentAlert;
}

const alertConfig = {
  warning: {
    icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-100',
  },
  info: {
    icon: <Info className="w-4 h-4 text-blue-500" />,
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-100',
  },
  document: {
    icon: <FileWarning className="w-4 h-4 text-orange-500" />,
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-100',
  },
};

function AlertItem({ alert }: AlertItemProps) {
  const navigate = useNavigate();
  const config = alertConfig[alert.type];

  const handleClick = () => {
    if (alert.type === 'document') {
      navigate('/document-requests');
    } else if (alert.title.toLowerCase().includes('schedule') || alert.description.toLowerCase().includes('schedule') || alert.description.toLowerCase().includes('friday')) {
      navigate('/schedule-requests');
    } else {
      navigate('/notifications');
    }
  };

  return (
    <div
      onClick={handleClick}
      className={cn('flex gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50/10 transition-colors', config.bgColor, config.borderColor)}
    >
      <div className="flex-shrink-0 mt-0.5">{config.icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{alert.title}</p>
        <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{alert.description}</p>
        <p className="text-xs text-gray-400 mt-1.5">{alert.timeAgo}</p>
      </div>
    </div>
  );
}

interface RecentAlertsProps {
  alerts: RecentAlert[];
}

export function RecentAlerts({ alerts }: RecentAlertsProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card">
      <div className="px-5 pt-5 pb-3">
        <h3 className="font-semibold text-gray-900 text-base mb-3">Recent Alerts</h3>
        <div className="space-y-2">
          {alerts.map((alert) => (
            <AlertItem key={alert.id} alert={alert} />
          ))}
        </div>
      </div>
    </div>
  );
}
