import React from 'react';
import { MapPin, ArrowRight } from 'lucide-react';
import type { Parish } from '../../../types';
import { Card } from '../../../components/ui/Card';

interface ParishCardProps {
  parish: Parish;
  isSelected: boolean;
  onClick: () => void;
}

export const ParishCard: React.FC<ParishCardProps> = ({ parish, isSelected, onClick }) => {
  return (
    <Card
      hoverable
      onClick={onClick}
      className={`cursor-pointer border transition-all p-4 ${
        isSelected ? 'border-crimson ring-2 ring-red-50 bg-red-50/10' : 'border-border'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h3 className="font-serif font-bold text-text-primary text-sm">
            {parish.name}
          </h3>
          <p className="text-xs text-text-muted flex items-center">
            <MapPin size={12} className="mr-1 flex-shrink-0 text-crimson" />
            <span className="truncate max-w-[250px]">{parish.address}</span>
          </p>
        </div>
        <ArrowRight size={14} className={`text-crimson transition-transform ${isSelected ? 'translate-x-1' : ''}`} />
      </div>
    </Card>
  );
};
export default ParishCard;
