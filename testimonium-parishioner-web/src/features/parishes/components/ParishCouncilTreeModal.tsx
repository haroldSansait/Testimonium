import React, { useState } from 'react';
import { Users, Landmark, ChevronDown } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Avatar } from '../../../components/ui/Avatar';
import type { Parish } from '../../../types';

interface ParishCouncilTreeModalProps {
  isOpen: boolean;
  onClose: () => void;
  parishName: string;
  councils?: Parish['councils'];
}

type CouncilType = 'pastoral' | 'finance';

export const ParishCouncilTreeModal: React.FC<ParishCouncilTreeModalProps> = ({
  isOpen,
  onClose,
  parishName,
  councils,
}) => {
  const [activeTab, setActiveTab] = useState<CouncilType>('pastoral');

  if (!isOpen) return null;

  const pastoralMembers = councils?.pastoral?.members || [];
  const financeMembers = councils?.finance?.members || [];
  const hasFinanceCouncil = councils?.finance !== null && councils?.finance !== undefined;

  // Selected council members based on active tab
  const currentMembers = activeTab === 'pastoral' ? pastoralMembers : financeMembers;
  const leadOfficer = currentMembers.length > 0 ? currentMembers[0] : null;
  const subsequentOfficers = currentMembers.length > 1 ? currentMembers.slice(1) : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${parishName} — Organizational Hierarchy`}
      size="3xl"
      className="max-w-3xl"
    >
      <div className="space-y-4">
        {/* Council Switcher Tabs (Only displayed if PFC exists / is enabled) */}
        {hasFinanceCouncil && (
          <div className="flex border-b border-border/80 gap-2">
            <button
              onClick={() => setActiveTab('pastoral')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'pastoral'
                  ? 'border-crimson text-crimson'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              <Users size={14} />
              <span>Pastoral Council (PPC)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                {pastoralMembers.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('finance')}
              className={`pb-2.5 px-3 text-xs font-bold transition-all flex items-center gap-1.5 border-b-2 ${
                activeTab === 'finance'
                  ? 'border-crimson text-crimson'
                  : 'border-transparent text-text-muted hover:text-text-primary'
              }`}
            >
              <Landmark size={14} />
              <span>Finance Council (PFC)</span>
              <span className="ml-1 text-[10px] px-1.5 py-0.2 rounded-full bg-slate-100 text-slate-600">
                {financeMembers.length}
              </span>
            </button>
          </div>
        )}

        {/* Council Subtitle / Description */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-1">
          <div>
            <h3 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
              {activeTab === 'pastoral' ? (
                <>
                  <Users size={16} className="text-crimson" />
                  <span>Parish Pastoral Council Organizational Tree</span>
                </>
              ) : (
                <>
                  <Landmark size={16} className="text-crimson" />
                  <span>Parish Finance Council Organizational Tree</span>
                </>
              )}
            </h3>
            <p className="text-[11px] text-text-muted">
              Hierarchy based on authoritative parish council officer assignments.
            </p>
          </div>
          <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider bg-slate-50 px-2 py-1 rounded border border-border/50 self-start sm:self-auto">
            {currentMembers.length} Configured {currentMembers.length === 1 ? 'Officer' : 'Officers'}
          </span>
        </div>

        {/* Empty State */}
        {currentMembers.length === 0 ? (
          <div className="py-12 px-4 text-center bg-app-page/60 rounded-xl border border-dashed border-border/80 space-y-2">
            <Users size={32} className="mx-auto text-slate-300" />
            <p className="text-xs font-semibold text-text-primary">
              {activeTab === 'pastoral'
                ? 'Parish Pastoral Council has not yet been configured.'
                : 'Parish Finance Council has not yet been configured.'}
            </p>
            <p className="text-[11px] text-text-muted">
              Officer assignments and photos will appear here once published by parish administration.
            </p>
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {/* Top / Apex Lead Officer */}
            {leadOfficer && (
              <div className="flex flex-col items-center">
                <div className="w-full max-w-sm bg-gradient-to-b from-red-50/70 to-white border-2 border-crimson/30 rounded-xl p-4 shadow-sm text-center relative">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-crimson text-white text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-xs">
                    Leading Office
                  </div>
                  <div className="flex flex-col items-center gap-2 mt-1">
                    <Avatar
                      src={leadOfficer.photoUrl}
                      name={leadOfficer.memberName}
                      size="xl"
                      className="border-2 border-crimson/20 shadow-xs"
                    />
                    <div>
                      <h4 className="font-bold text-text-primary text-sm sm:text-base leading-snug">
                        {leadOfficer.memberName}
                      </h4>
                      <p className="text-xs font-semibold text-crimson uppercase tracking-wide mt-0.5">
                        {leadOfficer.positionTitle}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Connector Branch Line if there are subsequent officers */}
                {subsequentOfficers.length > 0 && (
                  <div className="flex flex-col items-center my-1">
                    <div className="w-0.5 h-6 bg-crimson/30"></div>
                    <ChevronDown size={14} className="text-crimson/50 -mt-1" />
                  </div>
                )}
              </div>
            )}

            {/* Subsequent Officers: Desktop Tiered Grid vs Mobile Vertical Tree */}
            {subsequentOfficers.length > 0 && (
              <div>
                {/* Desktop view: responsive grid with visual cards (hidden on small phones) */}
                <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {subsequentOfficers.map((officer, index) => (
                    <div
                      key={`desktop-officer-${index}-${officer.positionTitle}-${officer.memberName}`}
                      className="bg-white p-3 rounded-xl border border-border hover:border-crimson/30 transition-all shadow-xs flex items-center gap-3"
                    >
                      <Avatar
                        src={officer.photoUrl}
                        name={officer.memberName}
                        size="md"
                        className="border border-border/80"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider block truncate">
                          {officer.positionTitle}
                        </span>
                        <span className="text-xs font-bold text-text-primary block truncate">
                          {officer.memberName}
                        </span>
                        <span className="text-[9px] text-text-muted block mt-0.5">
                          Tier #{index + 2}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile / Phone view: Vertical branch list to prevent horizontal overflow */}
                <div className="sm:hidden relative pl-6 border-l-2 border-crimson/25 space-y-3 ml-3">
                  {subsequentOfficers.map((officer, index) => (
                    <div
                      key={`mobile-officer-${index}-${officer.positionTitle}-${officer.memberName}`}
                      className="relative bg-white p-2.5 rounded-lg border border-border shadow-xs flex items-center gap-2.5"
                    >
                      {/* Branch dot connecting to vertical line */}
                      <span className="absolute -left-[31px] top-1/2 -translate-y-1/2 w-3 h-0.5 bg-crimson/30"></span>
                      <span className="absolute -left-[35px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-crimson"></span>

                      <Avatar
                        src={officer.photoUrl}
                        name={officer.memberName}
                        size="sm"
                        className="border border-border/80"
                      />
                      <div className="min-w-0 flex-1">
                        <span className="text-[10px] font-semibold text-text-muted uppercase tracking-wider block truncate">
                          {officer.positionTitle}
                        </span>
                        <span className="text-xs font-bold text-text-primary block truncate">
                          {officer.memberName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
};
