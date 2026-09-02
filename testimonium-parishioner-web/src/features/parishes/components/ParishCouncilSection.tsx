import React from 'react';
import { Users, Landmark, Info } from 'lucide-react';
import type { Parish } from '../../../types';

interface ParishCouncilSectionProps {
  councils?: Parish['councils'];
  loading?: boolean;
}

export const ParishCouncilSection: React.FC<ParishCouncilSectionProps> = ({
  councils,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-3">
        <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
          <Users size={13} className="text-crimson" />
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Parish Pastoral Council
          </span>
        </div>
        <div className="space-y-2 animate-pulse">
          <div className="h-4 bg-slate-200/80 rounded-md w-3/4"></div>
          <div className="h-4 bg-slate-200/80 rounded-md w-1/2"></div>
        </div>
      </div>
    );
  }

  // If council configuration is completely missing/unavailable from backend
  if (councils === null || councils === undefined) {
    return (
      <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-2">
        <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
          <Users size={13} className="text-crimson" />
          <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
            Parish Councils
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-text-muted py-1">
          <Info size={14} className="text-slate-400 flex-shrink-0" />
          <span>Council information is currently unavailable.</span>
        </div>
      </div>
    );
  }

  const { pastoral, finance } = councils;
  const pastoralMembers = pastoral?.members || [];
  const financeMembers = finance?.members || [];

  return (
    <div className="space-y-4">
      {/* Parish Pastoral Council (Always rendered) */}
      <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-2.5">
        <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
          <span className="text-[10px] font-bold text-text-muted uppercase flex items-center tracking-wider">
            <Users size={12} className="mr-1.5 text-crimson" />
            Parish Pastoral Council
          </span>
          <span className="text-[10px] text-text-muted font-medium">
            {pastoralMembers.length > 0 ? `${pastoralMembers.length} Officers` : 'Directory'}
          </span>
        </div>

        {pastoralMembers.length === 0 ? (
          <p className="text-xs text-text-muted italic py-1">
            Parish Pastoral Council information has not yet been added.
          </p>
        ) : (
          <div className="divide-y divide-border/40 text-xs">
            {pastoralMembers.map((member, index) => (
              <div
                key={`ppc-${index}-${member.positionTitle}-${member.memberName}`}
                className="py-2 first:pt-0.5 last:pb-0.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2"
              >
                <span className="text-[11px] font-semibold text-text-muted">
                  {member.positionTitle}
                </span>
                <span className="font-bold text-text-primary sm:text-right">
                  {member.memberName}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parish Finance Council (Only rendered when finance is enabled/non-null) */}
      {finance !== null && (
        <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-2.5">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/50">
            <span className="text-[10px] font-bold text-text-muted uppercase flex items-center tracking-wider">
              <Landmark size={12} className="mr-1.5 text-crimson" />
              Parish Finance Council
            </span>
            <span className="text-[10px] text-text-muted font-medium">
              {financeMembers.length > 0 ? `${financeMembers.length} Officers` : 'Directory'}
            </span>
          </div>

          {financeMembers.length === 0 ? (
            <p className="text-xs text-text-muted italic py-1">
              Parish Finance Council information has not yet been added.
            </p>
          ) : (
            <div className="divide-y divide-border/40 text-xs">
              {financeMembers.map((member, index) => (
                <div
                  key={`pfc-${index}-${member.positionTitle}-${member.memberName}`}
                  className="py-2 first:pt-0.5 last:pb-0.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-2"
                >
                  <span className="text-[11px] font-semibold text-text-muted">
                    {member.positionTitle}
                  </span>
                  <span className="font-bold text-text-primary sm:text-right">
                    {member.memberName}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
