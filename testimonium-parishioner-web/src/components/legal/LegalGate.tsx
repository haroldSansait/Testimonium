import React, { useState } from 'react';
import { Scale, ShieldAlert, ShieldCheck, RefreshCw, LogOut } from 'lucide-react';
import { useAuth, type LegalPayload } from '../../contexts/AuthContext';
import { useLegalPolicies } from '../../services/legalPolicyService';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';
import { TermsModal } from '../modals/TermsModal';
import { PrivacyModal } from '../modals/PrivacyModal';

export const LegalGate: React.FC = () => {
  const { appProfile, recordLegalAcceptance, logout } = useAuth();
  const { policies, loading: policiesLoading, error: policiesError, refetch } = useLegalPolicies();

  const needsTerms = Boolean(appProfile && !appProfile.termsAccepted);
  const needsPrivacy = Boolean(appProfile && !appProfile.privacyAccepted);

  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);

  const canSubmit =
    (!needsTerms || termsChecked) &&
    (!needsPrivacy || privacyChecked) &&
    Boolean(policies) &&
    !submitting &&
    !policiesLoading;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !policies) return;

    setSubmitting(true);
    setError(null);

    const payload: LegalPayload = {};
    if (needsTerms) {
      payload.termsAccepted = true;
      payload.termsVersion = policies.termsOfService.version;
    }
    if (needsPrivacy) {
      payload.privacyAccepted = true;
      payload.privacyVersion = policies.privacyPolicy.version;
    }

    try {
      await recordLegalAcceptance(payload);
    } catch (err: any) {
      if (err?.code === 'LEGAL_ACCEPTANCE_VERSION_CONFLICT' || err?.status === 409) {
        setError('The legal policies were updated by the diocese while you were reviewing. Please review the updated version and confirm acceptance.');
        setTermsChecked(false);
        setPrivacyChecked(false);
        await refetch();
      } else {
        setError(err?.message || 'Failed to record legal acceptance. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-app-base">
      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-slate-50 flex items-start space-x-4">
          <div className="p-3 bg-crimson/10 rounded-xl text-crimson flex-shrink-0">
            <Scale size={28} />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-serif font-bold text-gray-900">
              Legal Compliance Update
            </h1>
            <p className="text-xs text-gray-600 font-medium leading-relaxed">
              The Roman Catholic Diocese of San Carlos has updated its official policies. To continue accessing the parishioner portal, please review and accept the current terms.
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {policiesLoading ? (
            <div className="p-8 flex flex-col items-center justify-center space-y-3">
              <Spinner size="lg" className="text-crimson" />
              <p className="text-xs text-gray-600 font-medium">Fetching authoritative legal policies...</p>
            </div>
          ) : policiesError ? (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-3">
              <div className="flex items-start space-x-2.5">
                <ShieldAlert size={18} className="text-status-rejected flex-shrink-0 mt-0.5" />
                <div className="text-xs text-red-800 space-y-1">
                  <p className="font-semibold">Unable to load legal policies</p>
                  <p>{policiesError}</p>
                </div>
              </div>
              <div className="flex items-center space-x-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refetch()}
                  className="text-xs flex items-center space-x-1.5 py-1 px-3"
                >
                  <RefreshCw size={12} />
                  <span>Retry</span>
                </Button>
                <button
                  type="button"
                  onClick={() => logout()}
                  className="text-xs text-gray-500 hover:text-gray-800 flex items-center space-x-1"
                >
                  <LogOut size={12} />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800 flex items-start space-x-2">
                  <ShieldAlert size={16} className="text-status-rejected flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-4 p-4 bg-slate-50 rounded-xl border border-slate-200">
                {needsTerms && policies && (
                  <label className="flex items-start space-x-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={termsChecked}
                      onChange={(e) => setTermsChecked(e.target.checked)}
                      disabled={submitting}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus:ring-crimson cursor-pointer"
                    />
                    <span className="text-xs text-gray-900 font-medium leading-snug">
                      I agree to the updated{' '}
                      <button
                        type="button"
                        onClick={() => setIsTermsModalOpen(true)}
                        className="font-bold text-crimson hover:underline focus:outline-none"
                      >
                        Terms of Service ({policies.termsOfService.version})
                      </button>
                    </span>
                  </label>
                )}

                {needsPrivacy && policies && (
                  <label className="flex items-start space-x-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={privacyChecked}
                      onChange={(e) => setPrivacyChecked(e.target.checked)}
                      disabled={submitting}
                      className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus:ring-crimson cursor-pointer"
                    />
                    <span className="text-xs text-gray-900 font-medium leading-snug">
                      I acknowledge the updated{' '}
                      <button
                        type="button"
                        onClick={() => setIsPrivacyModalOpen(true)}
                        className="font-bold text-crimson hover:underline focus:outline-none"
                      >
                        Privacy Policy ({policies.privacyPolicy.version})
                      </button>
                    </span>
                  </label>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => logout()}
                  disabled={submitting}
                  className="text-xs text-gray-500 hover:text-gray-800 flex items-center space-x-1.5 focus:outline-none"
                >
                  <LogOut size={14} />
                  <span>Sign Out</span>
                </button>

                <Button
                  type="submit"
                  loading={submitting}
                  disabled={!canSubmit}
                  className="text-xs flex items-center space-x-2 py-2 px-5"
                >
                  <ShieldCheck size={16} />
                  <span>Accept &amp; Continue</span>
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>

      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
    </div>
  );
};

export default LegalGate;
