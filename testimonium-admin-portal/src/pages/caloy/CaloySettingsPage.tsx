import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Lock,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  Shield,
  ShieldAlert,
  Sliders,
} from 'lucide-react';
import { caloyAdminApi, type CaloySettingsResponse, type PatchCaloySettingsPayload } from '@/api/caloyAdminApi';
import { CustomSelect } from '@/components/ui/CustomSelect';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

export function CaloySettingsPage({ initialData = null }: { initialData?: CaloySettingsResponse | null } = {}) {
  const [data, setData] = useState<CaloySettingsResponse | null>(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [conflictError, setConflictError] = useState(false);

  // Form Fields
  const [enabled, setEnabled] = useState(initialData?.effectiveValues.enabled ?? true);
  const [generationModel, setGenerationModel] = useState(initialData?.effectiveValues.generationModel ?? '');
  const [aiTenMinuteMax, setAiTenMinuteMax] = useState(initialData?.effectiveValues.aiTenMinuteMax ?? 20);
  const [aiDailyMax, setAiDailyMax] = useState(initialData?.effectiveValues.aiDailyMax ?? 50);
  const [chatbotRequestDeadlineMs, setChatbotRequestDeadlineMs] = useState(initialData?.effectiveValues.chatbotRequestDeadlineMs ?? 25000);
  const [automaticRetentionEnabled, setAutomaticRetentionEnabled] = useState(initialData?.effectiveValues.automaticRetentionEnabled ?? false);
  const [logRetentionDays, setLogRetentionDays] = useState(initialData?.effectiveValues.logRetentionDays ?? 90);

  // Form Validation Errors
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Determine dirty state by comparing with loaded effectiveValues
  const isDirty = useMemo(() => {
    if (!data) return false;
    return (
      enabled !== data.effectiveValues.enabled ||
      generationModel !== data.effectiveValues.generationModel ||
      Number(aiTenMinuteMax) !== Number(data.effectiveValues.aiTenMinuteMax) ||
      Number(aiDailyMax) !== Number(data.effectiveValues.aiDailyMax) ||
      Number(chatbotRequestDeadlineMs) !== Number(data.effectiveValues.chatbotRequestDeadlineMs) ||
      automaticRetentionEnabled !== data.effectiveValues.automaticRetentionEnabled ||
      Number(logRetentionDays) !== Number(data.effectiveValues.logRetentionDays)
    );
  }, [
    data,
    enabled,
    generationModel,
    aiTenMinuteMax,
    aiDailyMax,
    chatbotRequestDeadlineMs,
    automaticRetentionEnabled,
    logRetentionDays,
  ]);

  // Synchronize unsaved changes protection across window, beforeunload, and layout guards
  useUnsavedChanges({
    isDirty,
    message: 'You have unsaved changes in Caloy settings. Are you sure you want to leave without saving?',
  });

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).hasUnsavedSettingsChanges = false;
      }
    };
  }, []);

  const handleDiscard = () => {
    if (!data) return;
    setEnabled(data.effectiveValues.enabled);
    setGenerationModel(data.effectiveValues.generationModel);
    setAiTenMinuteMax(data.effectiveValues.aiTenMinuteMax);
    setAiDailyMax(data.effectiveValues.aiDailyMax);
    setChatbotRequestDeadlineMs(data.effectiveValues.chatbotRequestDeadlineMs);
    setAutomaticRetentionEnabled(data.effectiveValues.automaticRetentionEnabled);
    setLogRetentionDays(data.effectiveValues.logRetentionDays);
    setFormErrors({});
  };

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      setConflictError(false);
      setSuccessMessage(null);

      const res = await caloyAdminApi.getSettings();
      setData(res);

      // Populate form from effective/configured values
      setEnabled(res.effectiveValues.enabled);
      setGenerationModel(res.effectiveValues.generationModel);
      setAiTenMinuteMax(res.effectiveValues.aiTenMinuteMax);
      setAiDailyMax(res.effectiveValues.aiDailyMax);
      setChatbotRequestDeadlineMs(res.effectiveValues.chatbotRequestDeadlineMs);
      setAutomaticRetentionEnabled(res.effectiveValues.automaticRetentionEnabled);
      setLogRetentionDays(res.effectiveValues.logRetentionDays);
      if (typeof window !== 'undefined') {
        (window as any).hasUnsavedSettingsChanges = false;
      }
    } catch (err: any) {
      console.error('Failed to load settings:', err);
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to load Caloy settings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialData) loadSettings();
  }, [loadSettings, initialData]);

  const validateForm = () => {
    const errs: Record<string, string> = {};

    if (!generationModel) {
      errs.generationModel = 'Generation model must be selected from the catalog.';
    }
    if (aiTenMinuteMax < 5 || aiTenMinuteMax > 100) {
      errs.aiTenMinuteMax = 'Ten-minute question limit must be between 5 and 100.';
    }
    if (aiDailyMax < 10 || aiDailyMax > 500) {
      errs.aiDailyMax = 'Daily question limit must be between 10 and 500.';
    }
    if (aiDailyMax < aiTenMinuteMax) {
      errs.aiDailyMax = 'Daily limit must be greater than or equal to the 10-minute limit.';
    }
    if (chatbotRequestDeadlineMs < 5000 || chatbotRequestDeadlineMs > 28000) {
      errs.chatbotRequestDeadlineMs = 'Request deadline must be between 5,000ms and 28,000ms (to maintain safe client timeout margin).';
    }
    if (logRetentionDays < 14 || logRetentionDays > 365) {
      errs.logRetentionDays = 'Retention period must be between 14 and 365 days.';
    }

    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!data) return;
    if (saving) return; // Prevent double submit

    if (!validateForm()) return;

    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null);
      setConflictError(false);

      const payload: PatchCaloySettingsPayload = {
        expectedVersion: data.version,
        enabled,
        generationModel,
        aiTenMinuteMax: Number(aiTenMinuteMax),
        aiDailyMax: Number(aiDailyMax),
        chatbotRequestDeadlineMs: Number(chatbotRequestDeadlineMs),
        automaticRetentionEnabled,
        logRetentionDays: Number(logRetentionDays),
      };

      const updated = await caloyAdminApi.updateSettings(payload);
      setData(updated);
      setSuccessMessage('Caloy settings updated successfully.');
      if (typeof window !== 'undefined') {
        (window as any).hasUnsavedSettingsChanges = false;
      }

      // Update form state with server-authoritative response
      setEnabled(updated.effectiveValues.enabled);
      setGenerationModel(updated.effectiveValues.generationModel);
      setAiTenMinuteMax(updated.effectiveValues.aiTenMinuteMax);
      setAiDailyMax(updated.effectiveValues.aiDailyMax);
      setChatbotRequestDeadlineMs(updated.effectiveValues.chatbotRequestDeadlineMs);
      setAutomaticRetentionEnabled(updated.effectiveValues.automaticRetentionEnabled);
      setLogRetentionDays(updated.effectiveValues.logRetentionDays);
    } catch (err: any) {
      console.error('Update settings failed:', err);
      if (err?.response?.status === 409 || err?.response?.data?.error?.code === 'CONFIG_VERSION_CONFLICT') {
        setConflictError(true);
      } else {
        setError(err?.response?.data?.error?.message || err?.message || 'Failed to update Caloy settings.');
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-xl shadow-sm border border-gray-100">
        <RefreshCw className="w-8 h-8 text-crimson-700 animate-spin mb-3" />
        <p className="text-sm text-gray-500 font-medium">Loading runtime configuration...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center shadow-sm">
        <ShieldAlert className="w-10 h-10 text-red-600 mx-auto mb-3" />
        <h3 className="text-lg font-semibold text-red-800">Unable to Load Settings</h3>
        <p className="text-sm text-red-600 mt-1 max-w-md mx-auto">{error}</p>
        <button
          onClick={loadSettings}
          className="mt-4 px-4 py-2 bg-red-700 text-white text-sm font-medium rounded-lg hover:bg-red-800 transition-colors shadow-sm inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const isDeploymentDisabled = !data.masterDeploymentGate.deploymentEnabled;

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top notices */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-800 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {data.configurationDegraded && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Runtime configuration is unavailable. Values shown are informational and saving is disabled until the database state can be verified.
        </div>
      )}

      {conflictError && (
        <div className="p-5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 shadow-sm">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-sm">Caloy settings changed in another session.</h4>
              <p className="text-xs text-amber-800 mt-1">
                Another diocese coordinator has saved settings since you opened this page. To prevent overwriting their changes, please reload the latest settings.
              </p>
              <button
                type="button"
                onClick={loadSettings}
                className="mt-3 px-3 py-1.5 bg-amber-700 text-white text-xs font-semibold rounded-lg hover:bg-amber-800 transition-colors inline-flex items-center gap-1.5 shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Latest Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-600" />
          <span>{error}</span>
        </div>
      )}

      {/* Unsaved Changes Banner */}
      {isDirty && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-900">You have unsaved changes</p>
              <p className="text-xs text-amber-700">
                Changes made to Caloy settings have not been saved yet.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDiscard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard
            </button>
            <button
              type="button"
              onClick={(e) => handleSave(e as any)}
              disabled={saving || !data.runtimeConfigDatabaseAvailable}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Now'}
            </button>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSave} className="space-y-6">
        {/* 1. Caloy Availability Section */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Shield className="w-5 h-5 text-crimson-700" />
                Caloy Availability Gate
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls whether parishioner mobile and web apps can query Caloy. Administrative and Knowledge Base tools remain operational regardless of this toggle.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={enabled}
                  disabled={isDeploymentDisabled}
                  onChange={(e) => setEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-crimson-700 peer-disabled:opacity-50"></div>
              </label>
              <span className="text-sm font-semibold text-gray-800">
                {enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {isDeploymentDisabled && (
            <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <span>
                Disabled by deployment configuration (<code className="font-mono text-gray-800">CHATBOT_ENABLED=false</code>). The deployment master gate overrides runtime toggles.
              </span>
            </div>
          )}
        </div>

        {/* 2. Response Generation Model Section */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-purple-700" />
                Response Generation Model
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Controls the Gemini model used for grounded RAG answer synthesis and live tool response composition.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Active Generation Model (Server-Approved Catalog)
              </label>
              <CustomSelect
                value={generationModel}
                onChange={(val) => setGenerationModel(String(val))}
                options={data.approvedModels.map((m) => ({
                  value: m.id,
                  label: `${m.displayName} (${m.id}) - ${m.description}`,
                }))}
                aria-label="Active Generation Model"
                triggerClassName={formErrors.generationModel ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : undefined}
              />
              {formErrors.generationModel && (
                <p className="text-xs text-red-600 mt-1">{formErrors.generationModel}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-lg border border-gray-100">
              <div>
                <span className="text-gray-500 font-medium">Configured Model:</span>{' '}
                <span className="font-mono text-gray-800">
                  {data.configuredValues.generationModel || 'None (Environment Default)'}
                </span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Effective Model:</span>{' '}
                <span className="font-mono text-gray-800 font-semibold">
                  {data.effectiveValues.generationModel}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. Read-Only Components (Semantic Router, Embeddings, Credentials) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Semantic Router */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Semantic Intent Router</span>
              <Server className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="font-mono text-sm font-bold text-gray-900 mt-1">
              {data.readOnlyComponents.semanticRouter.model}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Provider: {data.readOnlyComponents.semanticRouter.provider}</p>
            <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Dedicated model [read only]
            </div>
          </div>

          {/* Embeddings */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Embedding Engine</span>
              <Database className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="font-mono text-sm font-bold text-gray-900 mt-1">
              {data.readOnlyComponents.embedding.model}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">
              {data.readOnlyComponents.embedding.dimensions} dimensions ({data.readOnlyComponents.embedding.provider})
            </p>
            <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              Knowledge vectors [read only]
            </div>
          </div>

          {/* Provider Credentials Status */}
          <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Gemini Credentials</span>
              <Shield className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-1 flex items-center gap-2">
              {data.masterDeploymentGate.credentialsConfigured ? (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800">
                  <CheckCircle className="w-3.5 h-3.5" />
                  Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-red-100 text-red-800">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Missing API Key
                </span>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Loaded securely from environment</p>
            <div className="mt-3 pt-2 border-t border-gray-100 text-[10px] text-gray-400">
              Zero secret exposure guarantee
            </div>
          </div>
        </div>

        {/* 4. User AI Question Limits */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
            <Sliders className="w-5 h-5 text-crimson-700" />
            User AI Question Limits
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Sliding-window quotas for substantive AI queries per user. Zero-cost paths (social greetings, basic capabilities, and button clicks) never consume quota.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                10-Minute Question Limit (5–100)
              </label>
              <input
                type="number"
                min="5"
                max="100"
                value={aiTenMinuteMax}
                onChange={(e) => setAiTenMinuteMax(Number(e.target.value))}
                className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                  formErrors.aiTenMinuteMax
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-crimson-700'
                }`}
              />
              {formErrors.aiTenMinuteMax && (
                <p className="text-xs text-red-600 mt-1">{formErrors.aiTenMinuteMax}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Daily Question Limit (10–500)
              </label>
              <input
                type="number"
                min="10"
                max="500"
                value={aiDailyMax}
                onChange={(e) => setAiDailyMax(Number(e.target.value))}
                className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                  formErrors.aiDailyMax
                    ? 'border-red-500 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-crimson-700'
                }`}
              />
              {formErrors.aiDailyMax && (
                <p className="text-xs text-red-600 mt-1">{formErrors.aiDailyMax}</p>
              )}
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-2">
            Note: Quota limit thresholds propagate across instances via short TTL cache. Sliding-window timestamp history remains process-local.
          </p>
        </div>

        {/* 5. Safe Request Deadline */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-1">
            <Clock className="w-5 h-5 text-crimson-700" />
            Safe Request Deadline
          </h3>
          <p className="text-xs text-gray-500 mb-4">
            Maximum backend request processing budget in milliseconds. Must leave a minimum 4-second safety margin below client fetch timeouts (mobile Caloy timeout: 32s).
          </p>

          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Backend Deadline (ms, 5,000–28,000)
            </label>
            <input
              type="number"
              min="5000"
              max="28000"
              step="1000"
              value={chatbotRequestDeadlineMs}
              onChange={(e) => setChatbotRequestDeadlineMs(Number(e.target.value))}
              className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                formErrors.chatbotRequestDeadlineMs
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-crimson-700'
              }`}
            />
            {formErrors.chatbotRequestDeadlineMs && (
              <p className="text-xs text-red-600 mt-1">{formErrors.chatbotRequestDeadlineMs}</p>
            )}
            <span className="text-xs text-gray-500 block mt-1">
              Current: {(chatbotRequestDeadlineMs / 1000).toFixed(1)} seconds
            </span>
          </div>
        </div>

        {/* 6. Operational Telemetry Retention */}
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-crimson-700" />
              Operational Telemetry Retention
            </h3>
            <div className="flex items-center gap-3">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={automaticRetentionEnabled}
                  onChange={(e) => setAutomaticRetentionEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-crimson-700"></div>
              </label>
              <span className="text-xs font-semibold text-gray-700">
                {automaticRetentionEnabled ? 'Automatic Purge Active' : 'Automatic Purge Disabled'}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            When enabled, the backend scheduled maintenance worker permanently purges older chatbot operational logs and AI usage events once daily (03:00 Asia/Manila). Default is OFF for safety.
          </p>

          <div className="max-w-xs">
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Retention Cutoff Window (14–365 days)
            </label>
            <input
              type="number"
              min="14"
              max="365"
              value={logRetentionDays}
              onChange={(e) => setLogRetentionDays(Number(e.target.value))}
              className={`w-full text-sm px-3 py-2 border rounded-lg focus:outline-none focus:ring-1 ${
                formErrors.logRetentionDays
                  ? 'border-red-500 focus:ring-red-500'
                  : 'border-gray-300 focus:ring-crimson-700'
              }`}
            />
            {formErrors.logRetentionDays && (
              <p className="text-xs text-red-600 mt-1">{formErrors.logRetentionDays}</p>
            )}
            <span className="text-xs text-gray-400 block mt-1">
              Records older than {logRetentionDays} days will be permanently deleted.
            </span>
          </div>
        </div>

        {/* Submit Button Bar */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-gray-400">
            Runtime configuration version: <span className="font-mono font-bold text-gray-600">{data.version}</span>
            {data.updatedAt && ` · Last updated: ${new Date(data.updatedAt).toLocaleString()}`}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={isDirty ? handleDiscard : loadSettings}
              disabled={saving}
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {isDirty ? 'Discard Changes' : 'Reset'}
            </button>
            <button
              type="submit"
              disabled={saving || !data.runtimeConfigDatabaseAvailable}
              className="px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 transition-colors shadow-sm inline-flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Caloy Settings
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
