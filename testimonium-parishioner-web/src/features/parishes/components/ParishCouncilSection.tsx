import React, { useState } from 'react';
import { Users, Landmark, Info, Layers } from 'lucide-react';
import type { Parish } from '../../../types';
import { Avatar } from '../../../components/ui/Avatar';
import { ParishCouncilTreeModal } from './ParishCouncilTreeModal';

interface ParishCouncilSectionProps {
  councils?: Parish['councils'];
  loading?: boolean;
  parishName?: string;
}

export const ParishCouncilSection: React.FC<ParishCouncilSectionProps> = ({
  councils,
  loading = false,
  parishName = 'Parish',
}) => {
  const [isTreeModalOpen, setIsTreeModalOpen] = useState(false);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-3">
          <div className="flex items-center gap-2 pb-1.5 border-b border-border/50">
            <Landmark size={13} className="text-crimson" />
            <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">
              Parish Finance Council
            </span>
          </div>
          <div className="space-y-2 animate-pulse">
            <div className="h-4 bg-slate-200/80 rounded-md w-3/4"></div>
            <div className="h-4 bg-slate-200/80 rounded-md w-1/2"></div>
          </div>
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
  const hasMembers = pastoralMembers.length > 0 || financeMembers.length > 0;

  return (
    <div className={finance !== null ? "grid grid-cols-1 md:grid-cols-2 gap-4 items-start" : "space-y-4"}>
      {/* Parish Pastoral Council (Always rendered) */}
      <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-2.5">
        <div className="flex items-center justify-between pb-2 border-b border-border/50 gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Users size={13} className="text-crimson flex-shrink-0" />
            <span className="text-[10px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider truncate">
              Parish Pastoral Council
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-[10px] text-text-muted font-medium whitespace-nowrap">
              {pastoralMembers.length > 0 ? `${pastoralMembers.length} Officers` : 'Directory'}
            </span>
            {hasMembers && (
              <button
                type="button"
                onClick={() => setIsTreeModalOpen(true)}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-crimson hover:text-crimson-dark bg-red-50 hover:bg-red-100/80 px-2 py-0.5 rounded transition-colors focus-ring cursor-pointer whitespace-nowrap"
                title="View Organizational Tree"
              >
                <Layers size={10} />
                <span>Tree</span>
              </button>
            )}
          </div>
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
                className="py-2 first:pt-0.5 last:pb-0.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar
                    src={member.photoUrl}
                    name={member.memberName}
                    size="xs"
                  />
                  <div className="min-w-0">
                    <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide block truncate leading-tight">
                      {member.positionTitle}
                    </span>
                    <span className="font-bold text-text-primary text-xs block truncate mt-0.5">
                      {member.memberName}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Parish Finance Council (Only rendered when finance is enabled/non-null) */}
      {finance !== null && (
        <div className="bg-app-page/80 p-3.5 rounded-xl border border-border/50 space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-border/50 gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Landmark size={13} className="text-crimson flex-shrink-0" />
              <span className="text-[10px] sm:text-[11px] font-bold text-text-muted uppercase tracking-wider truncate">
                Parish Finance Council
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-[10px] text-text-muted font-medium whitespace-nowrap">
                {financeMembers.length > 0 ? `${financeMembers.length} Officers` : 'Directory'}
              </span>
              {hasMembers && (
                <button
                  type="button"
                  onClick={() => setIsTreeModalOpen(true)}
                  className="inline-flex items-center gap-1 text-[10px] font-bold text-crimson hover:text-crimson-dark bg-red-50 hover:bg-red-100/80 px-2 py-0.5 rounded transition-colors focus-ring cursor-pointer whitespace-nowrap"
                  title="View Organizational Tree"
                >
                  <Layers size={10} />
                  <span>Tree</span>
                </button>
              )}
            </div>
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
                  className="py-2 first:pt-0.5 last:pb-0.5 flex items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={member.photoUrl}
                      name={member.memberName}
                      size="xs"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wide block truncate leading-tight">
                        {member.positionTitle}
                      </span>
                      <span className="font-bold text-text-primary text-xs block truncate mt-0.5">
                        {member.memberName}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Organizational Hierarchy Modal */}
      <ParishCouncilTreeModal
        isOpen={isTreeModalOpen}
        onClose={() => setIsTreeModalOpen(false)}
        parishName={parishName}
        councils={councils}
      />
    </div>
  );
};
