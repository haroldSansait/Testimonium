import React from 'react';

interface AssistantPriest {
  id: string | number;
  name: string;
}

interface ParishPersonnelListProps {
  priest: string;
  secretary: string;
  assistantPriests?: AssistantPriest[];
}

export const ParishPersonnelList: React.FC<ParishPersonnelListProps> = ({
  priest,
  secretary,
  assistantPriests = [],
}) => {
  return (
    <div className="text-xs text-text-primary mt-1 leading-snug">
      <span className="font-semibold block">Parish Priest: {priest}</span>
      {assistantPriests && assistantPriests.length > 0 && (
        <div className="mt-0.5">
          {assistantPriests.map((asst) => (
            <span key={asst.id} className="text-text-muted block">
              Parochial Vicar: {asst.name}
            </span>
          ))}
        </div>
      )}
      <span className="text-text-muted block mt-0.5">Secretary: {secretary}</span>
    </div>
  );
};
export default ParishPersonnelList;
