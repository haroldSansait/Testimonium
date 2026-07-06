import {
  FileText,
  CalendarDays,
  Clock,
  ClipboardCheck,
} from 'lucide-react';
import type { StatCardData } from '@/types';
import { cn } from '@/utils/cn';

const iconMap: Record<string, React.ReactNode> = {
  FileText: <FileText className="w-6 h-6" />,
  CalendarDays: <CalendarDays className="w-6 h-6" />,
  Clock: <Clock className="w-6 h-6" />,
  ClipboardCheck: <ClipboardCheck className="w-6 h-6" />,
};

interface StatCardProps {
  card: StatCardData;
}

export function StatCard({ card }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-card p-5 flex flex-col gap-4 hover:shadow-card-hover transition-shadow duration-200">
      <div className={cn('w-11 h-11 rounded-lg flex items-center justify-center', card.bgColor)}>
        <span className={card.iconColor}>{iconMap[card.icon]}</span>
      </div>
      <div>
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1">
          {card.label}
        </p>
        <p className="text-4xl font-bold text-gray-900" style={{ fontFamily: 'Playfair Display, serif' }}>
          {card.value}
        </p>
      </div>
    </div>
  );
}
