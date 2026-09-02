import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Users,
  Plus,
  Save,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Building2,
} from 'lucide-react';
import { ParishCouncilService } from '@/services/ParishCouncilService';
import { CouncilMemberRow } from './CouncilMemberRow';
import { ParishFinanceCouncilEditor } from './ParishFinanceCouncilEditor';
import type {
  CouncilMemberDraft,
  ParishCouncilConfig,
  SaveCouncilPayload,
  ParishSelectorItem,
} from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/utils/cn';

import {
  type CouncilStateSnapshot,
  shouldReconcileAsSaved,
  createFinanceDraftMember,
  ensureFinanceDraftForEnabledState,
} from '@/utils/councilReconciliation';

export const ParishCouncilEditor: React.FC = () => {
  const { role, applicationUser } = useAuth();

  // Selector state
  const [parishes, setParishes] = useState<ParishSelectorItem[]>([]);
  const [loadingParishes, setLoadingParishes] = useState(true);
  const [selectedParishId, setSelectedParishId] = useState<string>('');
  const [pendingParishId, setPendingParishId] = useState<string | null>(null);
  const [showSwitchModal, setShowSwitchModal] = useState(false);

  // Council Editor state
  const [loadingCouncil, setLoadingCouncil] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staleConflict, setStaleConflict] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Baseline vs Draft
  const [baselineSnapshot, setBaselineSnapshot] = useState<CouncilStateSnapshot | null>(null);
  const [version, setVersion] = useState<number>(1);
  const [pastoralMembers, setPastoralMembers] = useState<CouncilMemberDraft[]>([]);
  const [financeCouncilEnabled, setFinanceCouncilEnabled] = useState<boolean>(false);
  const [financeMembers, setFinanceMembers] = useState<CouncilMemberDraft[]>([]);

  // Generation counter to protect against out-of-order responses
  const requestGenRef = useRef(0);

  // Load parishes list for selector
  const loadParishes = useCallback(async () => {
    setLoadingParishes(true);
    try {
      const items = await ParishCouncilService.getParishesForSelector();
      setParishes(items);

      // Secretary auto-selection of their assigned parish
      if (role === 'SECRETARY' && applicationUser?.parishId) {
        const assignedId = String(applicationUser.parishId);
        setSelectedParishId(assignedId);
      }
    } catch (err: any) {
      console.error('[ParishCouncilEditor] Failed to load selector parishes:', err);
      setToast({
        message: err?.message || 'Failed to load parishes list.',
        type: 'error',
      });
    } finally {
      setLoadingParishes(false);
    }
  }, [role, applicationUser]);

  useEffect(() => {
    void loadParishes();
  }, [loadParishes]);

  // Load council configuration for selected parish
  const loadCouncilConfig = useCallback(async (parishId: string) => {
    if (!parishId) {
      setBaselineSnapshot(null);
      setPastoralMembers([]);
      setFinanceMembers([]);
      setFinanceCouncilEnabled(false);
      setVersion(1);
      return;
    }

    const currentGen = ++requestGenRef.current;
    setLoadingCouncil(true);
    setStaleConflict(false);

    try {
      const config: ParishCouncilConfig = await ParishCouncilService.getCouncilConfig(parishId);

      // If a newer request was dispatched while this was in-flight, discard this response
      if (currentGen !== requestGenRef.current) return;

      const snapshot: CouncilStateSnapshot = {
        version: config.version || 1,
        financeCouncilEnabled: Boolean(config.financeCouncilEnabled),
        pastoralCouncilMembers: Array.isArray(config.pastoralCouncilMembers) ? config.pastoralCouncilMembers : [],
        financeCouncilMembers: Array.isArray(config.financeCouncilMembers) ? config.financeCouncilMembers : [],
      };

      setBaselineSnapshot(snapshot);
      setVersion(config.version || 1);
      setFinanceCouncilEnabled(Boolean(config.financeCouncilEnabled));
      setPastoralMembers(Array.isArray(config.pastoralCouncilMembers) ? config.pastoralCouncilMembers : []);
      const loadedFinance = Array.isArray(config.financeCouncilMembers) ? config.financeCouncilMembers : [];
      setFinanceMembers(ensureFinanceDraftForEnabledState(Boolean(config.financeCouncilEnabled), loadedFinance));
    } catch (err: any) {
      if (currentGen !== requestGenRef.current) return;
      console.error('[ParishCouncilEditor] Failed to load council config:', err);
      setToast({
        message: err?.message || 'Failed to load parish council configuration.',
        type: 'error',
      });
      setBaselineSnapshot(null);
    } finally {
      if (currentGen === requestGenRef.current) {
        setLoadingCouncil(false);
      }
    }
  }, []);

  useEffect(() => {
    if (selectedParishId) {
      void loadCouncilConfig(selectedParishId);
    }
  }, [selectedParishId, loadCouncilConfig]);

  // Detect unsaved changes (dirty state)
  const isDirty = useMemo(() => {
    if (!baselineSnapshot) return false;
    const current: CouncilStateSnapshot = {
      version,
      financeCouncilEnabled,
      pastoralCouncilMembers: pastoralMembers || [],
      financeCouncilMembers: financeMembers || [],
    };
    return (
      current.financeCouncilEnabled !== baselineSnapshot.financeCouncilEnabled ||
      JSON.stringify(current.pastoralCouncilMembers.map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() }))) !==
        JSON.stringify((baselineSnapshot.pastoralCouncilMembers || []).map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() }))) ||
      JSON.stringify(current.financeCouncilMembers.map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() }))) !==
        JSON.stringify((baselineSnapshot.financeCouncilMembers || []).map(m => ({ p: (m?.positionTitle || '').trim(), n: (m?.memberName || '').trim() })))
    );
  }, [baselineSnapshot, version, financeCouncilEnabled, pastoralMembers, financeMembers]);

  // Browser refresh/close guard & sync window flag
  useUnsavedChanges({
    isDirty,
    message: 'You have unsaved parish council changes. Are you sure you want to leave without saving?',
  });

  // Clean up global window flag on unmount
  useEffect(() => {
    return () => {
      (window as any).hasUnsavedSettingsChanges = false;
    };
  }, []);

  // Find duplicates within pastoral members
  const duplicatePastoralIndices = useMemo(() => {
    const indices = new Set<number>();
    const map = new Map<string, number>();
    (pastoralMembers || []).forEach((m, idx) => {
      const pos = (m?.positionTitle || '').trim().toLowerCase();
      const name = (m?.memberName || '').trim().toLowerCase();
      if (pos && name) {
        const key = `${name}::${pos}`;
        if (map.has(key)) {
          indices.add(idx);
          indices.add(map.get(key)!);
        } else {
          map.set(key, idx);
        }
      }
    });
    return indices;
  }, [pastoralMembers]);

  // Find duplicates within finance members
  const duplicateFinanceIndices = useMemo(() => {
    const indices = new Set<number>();
    const map = new Map<string, number>();
    (financeMembers || []).forEach((m, idx) => {
      const pos = (m?.positionTitle || '').trim().toLowerCase();
      const name = (m?.memberName || '').trim().toLowerCase();
      if (pos && name) {
        const key = `${name}::${pos}`;
        if (map.has(key)) {
          indices.add(idx);
          indices.add(map.get(key)!);
        } else {
          map.set(key, idx);
        }
      }
    });
    return indices;
  }, [financeMembers]);

  // Check overall form validity
  const validationError = useMemo(() => {
    const pastoral = pastoralMembers || [];
    const finance = financeMembers || [];

    // Check blank rows in PPC
    for (let i = 0; i < pastoral.length; i++) {
      const pos = (pastoral[i]?.positionTitle || '').trim();
      const name = (pastoral[i]?.memberName || '').trim();
      if (!pos) return `PPC member #${i + 1} is missing a position/title.`;
      if (!name) return `PPC member #${i + 1} is missing a name.`;
    }
    if (duplicatePastoralIndices.size > 0) {
      return 'Pastoral Council has duplicate member entries with the exact same name and position.';
    }

    // If PFC is enabled, check PFC rules
    if (financeCouncilEnabled) {
      if (finance.length === 0) {
        return 'At least 1 Finance Council member is required when the Finance Council is enabled.';
      }
      for (let i = 0; i < finance.length; i++) {
        const pos = (finance[i]?.positionTitle || '').trim();
        const name = (finance[i]?.memberName || '').trim();
        if (!pos) return `PFC member #${i + 1} is missing a position/title.`;
        if (!name) return `PFC member #${i + 1} is missing a name.`;
      }
      if (duplicateFinanceIndices.size > 0) {
        return 'Finance Council has duplicate member entries with the exact same name and position.';
      }
    }

    return null;
  }, [pastoralMembers, financeCouncilEnabled, financeMembers, duplicatePastoralIndices, duplicateFinanceIndices]);

  // Switch parish selection handler with dirty guard
  const handleParishChange = (newParishId: string) => {
    if (newParishId === selectedParishId) return;
    if (isDirty) {
      setPendingParishId(newParishId);
      setShowSwitchModal(true);
    } else {
      setSelectedParishId(newParishId);
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingParishId !== null) {
      setSelectedParishId(pendingParishId);
      setPendingParishId(null);
    }
    setShowSwitchModal(false);
  };

  const handleCancelSwitch = () => {
    setPendingParishId(null);
    setShowSwitchModal(false);
  };

  // PPC Member list operations
  const handleAddPastoralMember = () => {
    setPastoralMembers((prev) => [...prev, { positionTitle: '', memberName: '' }]);
  };

  const handleUpdatePastoralMember = (index: number, field: 'positionTitle' | 'memberName', value: string) => {
    setPastoralMembers((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleMoveUpPastoral = (index: number) => {
    if (index === 0) return;
    setPastoralMembers((prev) => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleMoveDownPastoral = (index: number) => {
    if (index >= pastoralMembers.length - 1) return;
    setPastoralMembers((prev) => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  const handleRemovePastoral = (index: number) => {
    setPastoralMembers((prev) => prev.filter((_, i) => i !== index));
  };

  // PFC Member & Enable state handlers
  const handleFinanceEnabledChange = (enabled: boolean) => {
    setFinanceCouncilEnabled(enabled);
    if (enabled && financeMembers.length === 0) {
      setFinanceMembers([createFinanceDraftMember()]);
    }
  };

  const handleFinanceMembersChange = (nextMembers: CouncilMemberDraft[]) => {
    if (financeCouncilEnabled && nextMembers.length === 0) {
      setFinanceMembers([createFinanceDraftMember()]);
    } else {
      setFinanceMembers(nextMembers);
    }
  };

  // Discard local changes back to baseline
  const handleDiscardChanges = () => {
    if (!baselineSnapshot) return;
    setVersion(baselineSnapshot.version || 1);
    const baselineEnabled = Boolean(baselineSnapshot.financeCouncilEnabled);
    const baselineFinance = Array.isArray(baselineSnapshot.financeCouncilMembers) ? baselineSnapshot.financeCouncilMembers : [];
    setFinanceCouncilEnabled(baselineEnabled);
    setPastoralMembers(Array.isArray(baselineSnapshot.pastoralCouncilMembers) ? baselineSnapshot.pastoralCouncilMembers : []);
    setFinanceMembers(ensureFinanceDraftForEnabledState(baselineEnabled, baselineFinance));
    setStaleConflict(false);
    setToast({ message: 'Unsaved changes discarded.', type: 'info' as any });
  };

  // Reload Latest from server (e.g. after 409 conflict)
  const handleReloadLatest = () => {
    if (selectedParishId) {
      void loadCouncilConfig(selectedParishId);
    }
  };

  // Save changes
  const handleSave = async () => {
    if (!selectedParishId || saving || !isDirty || validationError) return;

    setSaving(true);
    setStaleConflict(false);

    const payload: SaveCouncilPayload = {
      expectedVersion: version,
      financeCouncilEnabled,
      pastoralCouncilMembers: (pastoralMembers || []).map((m) => ({
        positionTitle: (m?.positionTitle || '').trim(),
        memberName: (m?.memberName || '').trim(),
      })),
      financeCouncilMembers: (financeMembers || []).map((m) => ({
        positionTitle: (m?.positionTitle || '').trim(),
        memberName: (m?.memberName || '').trim(),
      })),
    };

    try {
      const result = await ParishCouncilService.saveCouncil(selectedParishId, payload);

      const updatedSnapshot: CouncilStateSnapshot = {
        version: result.version || 1,
        financeCouncilEnabled: Boolean(result.financeCouncilEnabled),
        pastoralCouncilMembers: Array.isArray(result.pastoralCouncilMembers) ? result.pastoralCouncilMembers : [],
        financeCouncilMembers: Array.isArray(result.financeCouncilMembers) ? result.financeCouncilMembers : [],
      };

      setBaselineSnapshot(updatedSnapshot);
      setVersion(result.version || 1);
      setFinanceCouncilEnabled(Boolean(result.financeCouncilEnabled));
      setPastoralMembers(Array.isArray(result.pastoralCouncilMembers) ? result.pastoralCouncilMembers : []);
      setFinanceMembers(Array.isArray(result.financeCouncilMembers) ? result.financeCouncilMembers : []);

      setToast({
        message: 'Parish council information saved successfully.',
        type: 'success',
      });
    } catch (err: any) {
      console.error('[ParishCouncilEditor] Save error:', err);

      // Handle 409 Optimistic Concurrency Conflict
      if (err?.statusCode === 409 || err?.code === 'COUNCIL_CONFIGURATION_STALE') {
        setStaleConflict(true);
        setToast({
          message: 'Council information was updated by another administrator. Reload latest before saving.',
          type: 'warning',
        });
      } else {
        // Attempt network reconciliation check
        try {
          const fresh = await ParishCouncilService.getCouncilConfig(selectedParishId);
          if (shouldReconcileAsSaved(version, payload, baselineSnapshot, fresh)) {
            const updatedSnapshot: CouncilStateSnapshot = {
              version: fresh.version || 1,
              financeCouncilEnabled: Boolean(fresh.financeCouncilEnabled),
              pastoralCouncilMembers: Array.isArray(fresh.pastoralCouncilMembers) ? fresh.pastoralCouncilMembers : [],
              financeCouncilMembers: Array.isArray(fresh.financeCouncilMembers) ? fresh.financeCouncilMembers : [],
            };
            setBaselineSnapshot(updatedSnapshot);
            setVersion(fresh.version || 1);
            setFinanceCouncilEnabled(Boolean(fresh.financeCouncilEnabled));
            setPastoralMembers(Array.isArray(fresh.pastoralCouncilMembers) ? fresh.pastoralCouncilMembers : []);
            setFinanceMembers(Array.isArray(fresh.financeCouncilMembers) ? fresh.financeCouncilMembers : []);
            setToast({
              message: 'Changes verified and saved successfully.',
              type: 'success',
            });
            return;
          } else if (fresh.version !== version) {
            // Server version advanced but state differs -> treat as conflict
            setStaleConflict(true);
            setToast({
              message: 'Server council data differs from your submission. Reload latest before making changes.',
              type: 'warning',
            });
            return;
          }
        } catch {
          // Ignore secondary fetch error
        }

        setToast({
          message: err?.message || 'Failed to save council information. Your draft was preserved.',
          type: 'error',
        });
      }
    } finally {
      setSaving(false);
    }
  };

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const selectedParishName = parishes.find((p) => p.id === selectedParishId)?.name || 'Selected Parish';

  return (
    <div className="space-y-6">
      {/* Toast Alert Banner */}
      {toast && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm font-medium transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toast.type === 'warning'
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-red-50 text-red-800 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className="text-emerald-600 flex-shrink-0" />
            ) : toast.type === 'warning' ? (
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            ) : (
              <AlertCircle size={18} className="text-red-600 flex-shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs uppercase tracking-wider font-semibold opacity-70 hover:opacity-100 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header & Parish Selector Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-crimson-50 text-crimson-700 flex items-center justify-center font-bold">
              <Users size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Parish Councils Management</h2>
              <p className="text-xs text-slate-500">
                Configure display-only council officers for the public Vicariate Directory.
              </p>
            </div>
          </div>

          {/* Parish Selector */}
          <div className="flex items-center gap-3 min-w-[260px] sm:min-w-[320px]">
            <label htmlFor="parish-council-selector" className="text-xs font-semibold text-slate-600 flex-shrink-0">
              Parish:
            </label>
            <select
              id="parish-council-selector"
              value={selectedParishId}
              onChange={(e) => handleParishChange(e.target.value)}
              disabled={loadingParishes || saving || role === 'SECRETARY'}
              className="w-full px-3 py-2 text-sm font-medium bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-crimson-600/20 focus:border-crimson-600 transition-colors disabled:opacity-60 cursor-pointer"
            >
              <option value="">-- Select Parish --</option>
              {parishes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 409 Stale Conflict Alert */}
        {staleConflict && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
              <div className="text-xs sm:text-sm">
                <span className="font-bold">Concurrency Notice:</span> This council information was updated by another administrator. Reload the latest data to review changes before overwriting.
              </div>
            </div>
            <button
              onClick={handleReloadLatest}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-semibold text-xs transition-colors flex items-center gap-1.5 flex-shrink-0"
            >
              <RefreshCw size={14} />
              <span>Reload Latest</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      {!selectedParishId ? (
        <div className="bg-white p-12 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Building2 size={24} />
          </div>
          <h3 className="text-sm font-bold text-slate-700">Select a parish to manage its council information</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Choose a parish from the dropdown above to view, edit, or configure its Parish Pastoral Council (PPC) and Parish Finance Council (PFC) members.
          </p>
        </div>
      ) : loadingCouncil ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
          <Loader2 size={28} className="animate-spin text-crimson-600 mx-auto" />
          <p className="text-xs font-semibold text-slate-600">Loading council information for {selectedParishName}...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* SECTION 1: Parish Pastoral Council (PPC) */}
          <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 shadow-sm space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-slate-800">Parish Pastoral Council (PPC)</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    Always Enabled
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  The primary consultative body representing parish ministries, worship, education, and service.
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddPastoralMember}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-crimson-700 bg-crimson-50 hover:bg-crimson-100 border border-crimson-200 rounded-lg transition-colors cursor-pointer self-start sm:self-auto"
              >
                <Plus size={14} />
                <span>Add PPC Member</span>
              </button>
            </div>

            {/* PPC Member Rows */}
            {(!pastoralMembers || pastoralMembers.length === 0) ? (
              <div className="p-6 rounded-xl bg-slate-50 border border-dashed border-slate-200 text-center space-y-1">
                <p className="text-xs font-semibold text-slate-600">No PPC members configured</p>
                <p className="text-[11px] text-slate-400">
                  Click "Add PPC Member" above to add parish council officers.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {(pastoralMembers || []).map((member, index) => (
                  <CouncilMemberRow
                    key={member?.id || `ppc-${index}`}
                    member={member}
                    index={index}
                    totalCount={pastoralMembers.length}
                    onUpdate={handleUpdatePastoralMember}
                    onMoveUp={handleMoveUpPastoral}
                    onMoveDown={handleMoveDownPastoral}
                    onRemove={handleRemovePastoral}
                    isDuplicate={duplicatePastoralIndices.has(index)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* SECTION 2: Parish Finance Council (PFC) */}
          <ParishFinanceCouncilEditor
            enabled={financeCouncilEnabled}
            members={financeMembers}
            disabled={saving}
            onEnabledChange={handleFinanceEnabledChange}
            onMembersChange={handleFinanceMembersChange}
          />

          {/* Action Bar / Save Footer */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-50/80 border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {isDirty ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Unsaved Changes (v{version})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold text-slate-500 bg-slate-100">
                  <CheckCircle2 size={13} className="text-slate-400" />
                  Up to date (v{version})
                </span>
              )}

              {validationError && (
                <span className="text-xs text-red-600 font-semibold hidden md:inline">
                  {validationError}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={handleDiscardChanges}
                disabled={!isDirty || saving}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCcw size={14} />
                <span>Discard</span>
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={!isDirty || saving || Boolean(validationError)}
                className="px-5 py-2 text-xs font-bold text-white bg-crimson-600 hover:bg-crimson-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-xl shadow-sm hover:shadow transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {saving ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Saving Changes...</span>
                  </>
                ) : (
                  <>
                    <Save size={14} />
                    <span>Save Council Information</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Parish Switch Confirmation Modal */}
      {showSwitchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-2.5 rounded-xl bg-amber-50">
                <AlertTriangle size={24} />
              </div>
              <h4 className="text-base font-bold text-slate-900">Unsaved Changes</h4>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              You have unsaved council changes for <span className="font-bold text-slate-800">{selectedParishName}</span>.
              Discard them and switch parish?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={handleCancelSwitch}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Stay
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-sm"
              >
                Discard and Switch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div
          className={cn(
            'fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold animate-in slide-in-from-bottom-4 duration-200',
            toast.type === 'success'
              ? 'bg-emerald-700 text-white'
              : toast.type === 'warning'
              ? 'bg-amber-600 text-white'
              : 'bg-red-700 text-white'
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          ) : toast.type === 'warning' ? (
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
};
