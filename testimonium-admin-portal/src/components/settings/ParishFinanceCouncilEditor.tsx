import React from 'react';
import { Plus, Info } from 'lucide-react';
import type { CouncilMemberDraft } from '@/types';
import { FinanceCouncilMemberRow } from './FinanceCouncilMemberRow';
import { createFinanceDraftMember } from '@/utils/councilReconciliation';

export interface ParishFinanceCouncilEditorProps {
  enabled: boolean;
  members: CouncilMemberDraft[];
  disabled?: boolean;
  onEnabledChange: (enabled: boolean) => void;
  onMembersChange: (members: CouncilMemberDraft[]) => void;
}

export const ParishFinanceCouncilEditor: React.FC<ParishFinanceCouncilEditorProps> = ({
  enabled,
  members,
  disabled = false,
  onEnabledChange,
  onMembersChange,
}) => {
  const handleAddMember = () => {
    const newMember = createFinanceDraftMember();
    onMembersChange([...members, newMember]);
  };

  const handleUpdateMember = (index: number, field: 'positionTitle' | 'memberName', value: string) => {
    const updated = members.map((member, i) =>
      i === index ? { ...member, [field]: value } : member
    );
    onMembersChange(updated);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const next = [...members];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    onMembersChange(next);
  };

  const handleMoveDown = (index: number) => {
    if (index >= members.length - 1) return;
    const next = [...members];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    onMembersChange(next);
  };

  const handleRemoveMember = (index: number) => {
    const remaining = members.filter((_, i) => i !== index);
    if (enabled && remaining.length === 0) {
      onMembersChange([createFinanceDraftMember()]);
    } else {
      onMembersChange(remaining);
    }
  };

  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
      {/* Header & Toggle Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-slate-800">Parish Finance Council (PFC)</h3>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                enabled
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-slate-100 text-slate-500 border-slate-200'
              }`}
            >
              {enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Advisory council assisting the pastor in the administration of church goods and parish financial affairs.
          </p>
        </div>

        {/* Native Controlled Checkbox / Toggle */}
        <label className="relative flex items-center gap-2.5 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(e) => onEnabledChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="relative w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-crimson-600"></div>
          <span className="text-xs font-bold text-slate-700">
            {enabled ? 'PFC Active' : 'PFC Inactive'}
          </span>
        </label>
      </div>

      {/* Helper text explaining visibility & draft preservation */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 flex items-start gap-2.5 text-xs text-slate-600">
        <Info size={16} className="text-slate-500 flex-shrink-0 mt-0.5" />
        <span>
          Disabling the Finance Council hides it from the public directory but keeps saved members.
        </span>
      </div>

      {/* PFC Enabled vs Disabled Branch */}
      {enabled ? (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Finance Council Officers ({members.length})
            </span>
            <button
              type="button"
              onClick={handleAddMember}
              disabled={disabled}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-crimson-700 bg-crimson-50 hover:bg-crimson-100 border border-crimson-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={14} />
              <span>Add PFC Member</span>
            </button>
          </div>

          <div className="space-y-3">
            {members.map((member, index) => (
              <FinanceCouncilMemberRow
                key={member.id || `pfc-${index}`}
                member={member}
                index={index}
                totalCount={members.length}
                disabled={disabled}
                onUpdate={handleUpdateMember}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onRemove={handleRemoveMember}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs text-slate-500">
          This parish does not currently display a Parish Finance Council.
          {members.length > 0 && (
            <p className="mt-1 font-semibold text-slate-600">
              ({members.length} preserved member{members.length > 1 ? 's' : ''} stored)
            </p>
          )}
        </div>
      )}
    </div>
  );
};
