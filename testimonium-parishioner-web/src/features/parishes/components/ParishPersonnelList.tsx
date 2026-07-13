import React from 'react';

interface ParishPersonnelListProps {
  priest: string;
  secretary: string;
}

export const ParishPersonnelList: React.FC<ParishPersonnelListProps> = ({ priest, secretary }) => {
  return (
    <div className="text-xs text-text-primary mt-1 leading-snug">
      <span className="font-semibold block">Priest: {priest}</span>
      <span className="text-text-muted block mt-0.5">Secretary: {secretary}</span>
    </div>
  );
};
export default ParishPersonnelList;
