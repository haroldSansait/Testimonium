import React from 'react';

interface ParishMassScheduleProps {
  massSchedules: string[];
}

export const ParishMassSchedule: React.FC<ParishMassScheduleProps> = ({ massSchedules }) => {
  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider">
        Mass Schedule
      </h4>
      <ul className="text-xs space-y-1.5 text-text-primary">
        {massSchedules.map((mass, idx) => (
          <li key={idx} className="flex items-center space-x-2">
            <span className="w-1.5 h-1.5 bg-crimson rounded-full flex-shrink-0" />
            <span>{mass}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParishMassSchedule;
