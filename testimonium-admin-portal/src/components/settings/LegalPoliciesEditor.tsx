import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Scale,
  ShieldAlert,
  CheckCircle,
  RefreshCw,
  Save,
  RotateCcw,
  Info,
} from 'lucide-react';
import {
  LegalPolicyService,
  type ManagedLegalPolicy,
  type ManagePoliciesResponse,
} from '@/services/LegalPolicyService';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { cn } from '@/utils/cn';

export const LegalPoliciesEditor: React.FC = () => {
  const [policies, setPolicies] = useState<ManagePoliciesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState<string | null>(null);

  const [activeType, setActiveType] = useState<'TERMS_OF_SERVICE' | 'PRIVACY_POLICY'>('TERMS_OF_SERVICE');
  const [termsDraft, setTermsDraft] = useState('');
  const [privacyDraft, setPrivacyDraft] = useState('');
  const saveInFlightRef = useRef(false);

  const loadPolicies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await LegalPolicyService.getManagePolicies();
      setPolicies(data);
      setTermsDraft(data.termsOfService.content);
      setPrivacyDraft(data.privacyPolicy.content);
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to load legal policies.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPolicies();
  }, []);

  const currentPolicy: ManagedLegalPolicy | null = useMemo(() => {
    if (!policies) return null;
    return activeType === 'TERMS_OF_SERVICE' ? policies.termsOfService : policies.privacyPolicy;
  }, [policies, activeType]);

  const currentDraft = activeType === 'TERMS_OF_SERVICE' ? termsDraft : privacyDraft;

  const isCurrentDirty = useMemo(() => {
    if (!currentPolicy) return false;
    return currentDraft !== currentPolicy.content;
  }, [currentPolicy, currentDraft]);

  const isDirty = useMemo(() => {
    if (!policies) return false;
    return termsDraft !== policies.termsOfService.content || privacyDraft !== policies.privacyPolicy.content;
  }, [policies, termsDraft, privacyDraft]);

  useUnsavedChanges({ isDirty });

  const handleDraftChange = (text: string) => {
    if (activeType === 'TERMS_OF_SERVICE') {
      setTermsDraft(text);
    } else {
      setPrivacyDraft(text);
    }
    setConflictError(null);
    setSuccessMessage(null);
  };

  const handleDiscard = () => {
    if (!currentPolicy) return;
    if (activeType === 'TERMS_OF_SERVICE') {
      setTermsDraft(currentPolicy.content);
    } else {
      setPrivacyDraft(currentPolicy.content);
    }
    setConflictError(null);
    setSuccessMessage(null);
  };

  const handleReloadServerVersion = async () => {
    setLoading(true);
    setConflictError(null);
    try {
      const data = await LegalPolicyService.getManagePolicies();
      setPolicies(data);
      if (activeType === 'TERMS_OF_SERVICE') {
        setTermsDraft(data.termsOfService.content);
      } else {
        setPrivacyDraft(data.privacyPolicy.content);
      }
      setSuccessMessage('Reloaded latest policy content from server.');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || 'Failed to reload policy.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!currentPolicy || saveInFlightRef.current || saving || !isCurrentDirty) return;

    if (!currentDraft.trim()) {
      setError('Policy content cannot be empty.');
      return;
    }

    if (currentDraft.length > 50000) {
      setError(`Policy content exceeds 50,000 characters limit (current: ${currentDraft.length.toLocaleString()}).`);
      return;
    }

    saveInFlightRef.current = true;
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    setConflictError(null);

    try {
      const res = await LegalPolicyService.updatePolicy(activeType, {
        content: currentDraft,
        expectedRevision: currentPolicy.revision,
      });

      if (res.changed) {
        setSuccessMessage(
          `Successfully published ${
            activeType === 'TERMS_OF_SERVICE' ? 'Terms of Service' : 'Privacy Policy'
          } as ${res.policy.version} (Revision ${res.policy.revision}).`
        );
      } else {
        setSuccessMessage(
          `No content changes detected. Policy remains at ${res.policy.version} (Revision ${res.policy.revision}).`
        );
      }

      setPolicies((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          [activeType === 'TERMS_OF_SERVICE' ? 'termsOfService' : 'privacyPolicy']: res.policy,
        };
      });

      if (activeType === 'TERMS_OF_SERVICE') {
        setTermsDraft(res.policy.content);
      } else {
        setPrivacyDraft(res.policy.content);
      }
    } catch (err: any) {
      if (
        err?.response?.status === 409 ||
        err?.response?.data?.code === 'LEGAL_POLICY_VERSION_CONFLICT'
      ) {
        setConflictError(
          'Another Diocese Coordinator published an update to this policy while you were editing. Your current draft has been preserved. Please review and choose whether to reload the latest server version.'
        );
      } else {
        setError(err?.response?.data?.message || err?.message || 'Failed to publish legal policy update.');
      }
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  if (loading && !policies) {
    return (
      <div className="p-12 flex flex-col items-center justify-center space-y-3 bg-white rounded-xl border border-gray-200">
        <RefreshCw className="w-6 h-6 text-crimson-700 animate-spin" />
        <p className="text-xs text-gray-500 font-medium">Loading authoritative legal policies...</p>
      </div>
    );
  }

  if (error && !policies) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-xl space-y-3">
        <div className="flex items-start space-x-2.5">
          <ShieldAlert className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-900">Failed to load legal policies</p>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        </div>
        <button
          onClick={() => void loadPolicies()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Policy Selector Subtabs */}
      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => {
              setActiveType('TERMS_OF_SERVICE');
              setConflictError(null);
              setSuccessMessage(null);
            }}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5',
              activeType === 'TERMS_OF_SERVICE'
                ? 'bg-crimson-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            )}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Terms of Service</span>
            {policies && (
              <span
                className={cn(
                  'ml-1 text-[10px] px-1.5 py-0.5 rounded font-mono',
                  activeType === 'TERMS_OF_SERVICE' ? 'bg-crimson-800 text-white' : 'bg-gray-200 text-gray-700'
                )}
              >
                {policies.termsOfService.version}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveType('PRIVACY_POLICY');
              setConflictError(null);
              setSuccessMessage(null);
            }}
            className={cn(
              'px-4 py-2 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5',
              activeType === 'PRIVACY_POLICY'
                ? 'bg-crimson-700 text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            )}
          >
            <Scale className="w-3.5 h-3.5" />
            <span>Privacy Policy</span>
            {policies && (
              <span
                className={cn(
                  'ml-1 text-[10px] px-1.5 py-0.5 rounded font-mono',
                  activeType === 'PRIVACY_POLICY' ? 'bg-crimson-800 text-white' : 'bg-gray-200 text-gray-700'
                )}
              >
                {policies.privacyPolicy.version}
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isCurrentDirty || saving}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Discard</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!isCurrentDirty || saving}
            className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-crimson-700 hover:bg-crimson-800 rounded-lg transition-colors shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{saving ? 'Publishing...' : 'Publish Update'}</span>
          </button>
        </div>
      </div>

      {/* Notifications / Alerts */}
      {successMessage && (
        <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-900 animate-in fade-in">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {error && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start space-x-2.5 text-xs text-red-900 animate-in fade-in">
          <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {conflictError && (
        <div className="p-4 bg-amber-50 border-l-4 border-amber-500 border border-amber-200 rounded-xl space-y-3 animate-in fade-in">
          <div className="flex items-start space-x-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 space-y-1">
              <p className="font-bold">Concurrency Version Conflict (409)</p>
              <p>{conflictError}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2 pt-1">
            <button
              type="button"
              onClick={() => void handleReloadServerVersion()}
              className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold text-amber-900 bg-white border border-amber-300 rounded-lg hover:bg-amber-100/60 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5 text-amber-700" />
              <span>Discard Draft &amp; Reload Latest Server Version</span>
            </button>
          </div>
        </div>
      )}

      {/* Policy Metadata Card */}
      {currentPolicy && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-gray-50/70 border border-gray-200 rounded-xl text-xs">
          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Public Version
            </span>
            <span className="font-bold font-mono text-gray-900 text-sm">
              {currentPolicy.version}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Revision Number
            </span>
            <span className="font-medium text-gray-700">
              Revision #{currentPolicy.revision}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Effective Date
            </span>
            <span className="font-medium text-gray-700">
              {currentPolicy.effectiveAt
                ? new Date(currentPolicy.effectiveAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })
                : 'August 1, 2026'}
            </span>
          </div>

          <div className="space-y-0.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block">
              Last Updated By
            </span>
            <span className="font-medium text-gray-700 truncate block">
              {currentPolicy.updatedBy
                ? currentPolicy.updatedBy.fullName
                : 'System Canonical Seed'}
            </span>
          </div>
        </div>
      )}

      {/* Editor Surface */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="font-semibold text-gray-700">
            Plain Text Content ({activeType === 'TERMS_OF_SERVICE' ? 'Terms of Service' : 'Privacy Policy'})
          </span>
          <span className={cn('font-mono text-[11px]', currentDraft.length > 50000 ? 'text-red-600 font-bold' : 'text-gray-400')}>
            {currentDraft.length.toLocaleString()} / 50,000 characters
          </span>
        </div>

        <textarea
          rows={22}
          value={currentDraft}
          onChange={(e) => handleDraftChange(e.target.value)}
          disabled={saving}
          placeholder="Enter authoritative plain-text policy content here..."
          className="w-full p-4 text-xs font-mono text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 focus:outline-none transition-all leading-relaxed resize-y"
        />

        <div className="flex items-center space-x-2 text-[11px] text-gray-500 bg-blue-50/50 p-2.5 rounded-lg border border-blue-100">
          <Info className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span>
            Saving will advance the policy version (e.g. v1.0 &rarr; v2.0) if content was modified. Parishioners on Web and Android will be prompted to review and accept the newly published version.
          </span>
        </div>
      </div>
    </div>
  );
};

export default LegalPoliciesEditor;
