import React from 'react';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import type { CouncilMemberDraft } from '@/types';
import { OfficerPhotoUploader } from './OfficerPhotoUploader';

export interface FinanceCouncilMemberRowProps {
  member: CouncilMemberDraft;
  index: number;
  totalCount: number;
  disabled?: boolean;
  onUpdate: (index: number, field: 'positionTitle' | 'memberName', value: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onRemove: (index: number) => void;
  parishId?: string;
  onPhotoChange?: (index: number, photoUrl: string | null) => void;
}

export const FinanceCouncilMemberRow: React.FC<FinanceCouncilMemberRowProps> = ({
  member,
  index,
  totalCount,
  disabled = false,
  onUpdate,
  onMoveUp,
  onMoveDown,
  onRemove,
  parishId,
  onPhotoChange,
}) => {
  const isFirst = index === 0;
  const isLast = index === totalCount - 1;
  const positionTitle = member.positionTitle || '';
  const memberName = member.memberName || '';

  return (
    <div className="p-3 sm:p-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-white shadow-sm transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Row Index Indicator & Photo */}
        <div className="flex items-center gap-2.5">
          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-semibold text-xs flex items-center justify-center font-mono">
            {index + 1}
          </span>
          <OfficerPhotoUploader
            parishId={parishId}
            memberId={member?.id}
            photoUrl={member?.photoUrl}
            memberName={memberName}
            disabled={disabled}
            onPhotoUploaded={(url) => onPhotoChange?.(index, url)}
            onPhotoRemoved={() => onPhotoChange?.(index, null)}
          />
        </div>

        {/* Position / Role Input */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Position / Role <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={positionTitle}
            onChange={(e) => onUpdate(index, 'positionTitle', e.target.value)}
            disabled={disabled}
            placeholder="e.g. PFC Coordinator, Treasurer, Auditor"
            maxLength={200}
            className={`w-full px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
              !positionTitle.trim()
                ? 'border-amber-300 bg-amber-50/30 focus:ring-amber-500/20'
                : 'border-slate-200 focus:border-crimson-600 focus:ring-crimson-600/20'
            } disabled:bg-slate-50 disabled:text-slate-400`}
          />
        </div>

        {/* Member Name Input */}
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Member Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={memberName}
            onChange={(e) => onUpdate(index, 'memberName', e.target.value)}
            disabled={disabled}
            placeholder="e.g. Maria Santos"
            maxLength={200}
            className={`w-full px-3 py-1.5 text-sm rounded-lg border focus:outline-none focus:ring-2 transition-colors ${
              !memberName.trim()
                ? 'border-amber-300 bg-amber-50/30 focus:ring-amber-500/20'
                : 'border-slate-200 focus:border-crimson-600 focus:ring-crimson-600/20'
            } disabled:bg-slate-50 disabled:text-slate-400`}
          />
        </div>

        {/* Action Buttons: Move Up, Move Down, Remove */}
        <div className="flex items-center gap-1.5 self-end sm:self-center mt-2 sm:mt-5">
          <button
            type="button"
            onClick={() => onMoveUp(index)}
            disabled={disabled || isFirst}
            title="Move Up"
            aria-label={`Move ${memberName || 'member'} up`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          >
            <ArrowUp size={16} />
          </button>

          <button
            type="button"
            onClick={() => onMoveDown(index)}
            disabled={disabled || isLast}
            title="Move Down"
            aria-label={`Move ${memberName || 'member'} down`}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          >
            <ArrowDown size={16} />
          </button>

          <button
            type="button"
            onClick={() => onRemove(index)}
            disabled={disabled}
            title="Remove Member"
            aria-label={`Remove ${memberName || 'member'}`}
            className="p-1.5 rounded-lg text-red-500 hover:text-red-700 hover:bg-red-50 disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};
