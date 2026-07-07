import { useNavigate } from 'react-router-dom';
import {
  FileText,
  CalendarDays,
  Clock,
  ClipboardCheck,
  Church,
  MapPin,
  Compass,
  User,
  Users,
  PersonStanding,
} from 'lucide-react';
import type { StatCardData } from '@/types';
import { cn } from '@/utils/cn';

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-6 h-6" />,
  CalendarDays: <CalendarDays className="w-6 h-6" />,
  Clock: <Clock className="w-6 h-6" />,
  ClipboardCheck: <ClipboardCheck className="w-6 h-6" />,
  Church: <Church className="w-6 h-6" />,
  MapPin: <MapPin className="w-6 h-6" />,
  Compass: <Compass className="w-6 h-6" />,
  User: <User className="w-6 h-6" />,
  Users: <Users className="w-6 h-6" />,
  PersonStanding: <PersonStanding className="w-6 h-6" />,
};

interface StatCardProps {
  card: StatCardData;
}

export function StatCard({ card }: StatCardProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    const id = card.id;
    if (['pending-documents', 'needs-correction', 'ready-for-pickup', 'pending-doc-requests'].includes(id)) {
      navigate('/document-requests');
    } else if (['pending-schedules', 'pending-sched-requests'].includes(id)) {
      navigate('/schedule-requests');
    } else if (['total-parishes', 'total-quasi-parishes', 'total-mission-stations'].includes(id)) {
      navigate('/parish-management');
    } else if (['total-secretaries', 'total-priests', 'total-parishioners'].includes(id)) {
      navigate('/user-management');
    }
  };

  return (
    <div
      onClick={handleClick}
      className="bg-white rounded-xl border border-gray-100 shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover hover:border-gray-200 transition-all duration-200 cursor-pointer"
    >
      <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center', card.bgColor)}>
        <span className={card.iconColor}>{iconMap[card.icon]}</span>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
          {card.label}
        </p>
        <p className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, serif' }}>
          {card.value.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
