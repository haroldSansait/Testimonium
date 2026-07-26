import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Check, Church } from 'lucide-react';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ParishInfoData {
  name: string;
  type: 'Parish' | 'Quasi-Parish' | 'Mission Station' | '';
  vicariate: string;
  patronSaint: string;
  address: string;
  contactNumber: string;
  email: string;
}

interface PersonData {
  fullName: string;
  email: string;
  contactNumber: string;
}

export interface WizardData {
  parishInfo: ParishInfoData;
  secretary: PersonData;
  priest: PersonData;
}

const EMPTY_PARISH_INFO: ParishInfoData = {
  name: '',
  type: '',
  vicariate: '',
  patronSaint: '',
  address: '',
  contactNumber: '',
  email: '',
};

const EMPTY_PERSON: PersonData = { fullName: '', email: '', contactNumber: '' };

// ─── Shared form primitives ───────────────────────────────────────────────────

function FormField({
  label,
  id,
  required,
  children,
}: {
  label: string;
  id: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
        {label} {required && <span className="text-crimson-700">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all bg-white';

// ─── Step components ──────────────────────────────────────────────────────────

function Step1({ data, onChange }: { data: ParishInfoData; onChange: (d: ParishInfoData) => void }) {
  const set = (field: keyof ParishInfoData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [field]: e.target.value });

  return (
    <div className="space-y-4">
      <FormField label="Parish Name" id="parish-name" required>
        <input id="parish-name" className={inputCls} placeholder="e.g. St. Joseph the Worker Parish" value={data.name} onChange={set('name')} />
      </FormField>

      <FormField label="Parish Type" id="parish-type" required>
        <select id="parish-type" className={inputCls} value={data.type} onChange={set('type')}>
          <option value="">Select type...</option>
          <option value="Parish">Parish</option>
          <option value="Quasi-Parish">Quasi-Parish</option>
          <option value="Mission Station">Mission Station</option>
        </select>
      </FormField>

      <FormField label="Vicariate" id="parish-vicariate" required>
        <select id="parish-vicariate" className={inputCls} value={data.vicariate} onChange={set('vicariate')}>
          <option value="">Select vicariate...</option>
          <option value="Vicariate of Canlaon">Vicariate of Canlaon</option>
        </select>
      </FormField>

      <FormField label="Patron Saint" id="parish-patron">
        <input id="parish-patron" className={inputCls} placeholder="e.g. St. Joseph" value={data.patronSaint} onChange={set('patronSaint')} />
      </FormField>

      <FormField label="Address" id="parish-address">
        <input id="parish-address" className={inputCls} placeholder="Street, Barangay, City" value={data.address} onChange={set('address')} />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Contact Number" id="parish-contact">
          <input id="parish-contact" className={inputCls} placeholder="09XXXXXXXXX" value={data.contactNumber} onChange={set('contactNumber')} />
        </FormField>
        <FormField label="Email" id="parish-email">
          <input id="parish-email" type="email" className={inputCls} placeholder="parish@diocese.org" value={data.email} onChange={set('email')} />
        </FormField>
      </div>
    </div>
  );
}

function PersonStep({
  data,
  onChange,
  idPrefix,
}: {
  data: PersonData;
  onChange: (d: PersonData) => void;
  idPrefix: string;
}) {
  const set = (field: keyof PersonData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...data, [field]: e.target.value });

  return (
    <div className="space-y-4">
      <FormField label="Full Name" id={`${idPrefix}-name`} required>
        <input id={`${idPrefix}-name`} className={inputCls} placeholder="Full legal name" value={data.fullName} onChange={set('fullName')} />
      </FormField>
      <FormField label="Email Address" id={`${idPrefix}-email`} required>
        <input id={`${idPrefix}-email`} type="email" className={inputCls} placeholder="user@diocese.org" value={data.email} onChange={set('email')} />
      </FormField>
      <FormField label="Contact Number" id={`${idPrefix}-contact`}>
        <input id={`${idPrefix}-contact`} className={inputCls} placeholder="09XXXXXXXXX" value={data.contactNumber} onChange={set('contactNumber')} />
      </FormField>
    </div>
  );
}

function Step4Review({ data }: { data: WizardData }) {
  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div className="flex gap-2 text-sm">
        <span className="text-gray-500 w-32 flex-shrink-0">{label}</span>
        <span className="text-gray-900 font-medium">{value || '—'}</span>
      </div>
    );
  }

  function Section({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
    return (
      <div>
        <h4 className="text-xs font-bold text-grayson uppercase tracking-widest text-gray-400 mb-2">{title}</h4>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          {rows.map((r) => <Row key={r.label} {...r} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Section
        title="Parish Information"
        rows={[
          { label: 'Name',          value: data.parishInfo.name },
          { label: 'Type',          value: data.parishInfo.type },
          { label: 'Vicariate',     value: data.parishInfo.vicariate },
          { label: 'Patron Saint',  value: data.parishInfo.patronSaint },
          { label: 'Address',       value: data.parishInfo.address },
          { label: 'Contact',       value: data.parishInfo.contactNumber },
          { label: 'Email',         value: data.parishInfo.email },
        ]}
      />
      <Section
        title="Secretary Account"
        rows={[
          { label: 'Full Name', value: data.secretary.fullName },
          { label: 'Email',     value: data.secretary.email },
          { label: 'Contact',   value: data.secretary.contactNumber },
        ]}
      />
      <Section
        title="Priest Account"
        rows={[
          { label: 'Full Name', value: data.priest.fullName },
          { label: 'Email',     value: data.priest.email },
          { label: 'Contact',   value: data.priest.contactNumber },
        ]}
      />
    </div>
  );
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, title: 'Parish Information' },
  { number: 2, title: 'Secretary Account' },
  { number: 3, title: 'Priest Account' },
  { number: 4, title: 'Review & Finish' },
];

// ─── NewParishWizard ──────────────────────────────────────────────────────────

interface NewParishWizardProps {
  onClose: () => void;
  /**
   * Called when the user clicks Finish on the Review step.
   * Receives the full wizard data so the parent can persist it.
   * The wizard closes itself once this promise resolves.
   */
  onFinish?: (data: WizardData) => Promise<void>;
}

export function NewParishWizard({ onClose, onFinish }: NewParishWizardProps) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [data, setData] = useState<WizardData>({
    parishInfo: { ...EMPTY_PARISH_INFO },
    secretary: { ...EMPTY_PERSON },
    priest: { ...EMPTY_PERSON },
  });

  const isLastStep = step === STEPS.length;
  const canAdvance =
    step === 1
      ? Boolean(data.parishInfo.name && data.parishInfo.type && data.parishInfo.vicariate)
      : step === 2
      ? Boolean(data.secretary.fullName && data.secretary.email)
      : step === 3
      ? Boolean(data.priest.fullName && data.priest.email)
      : true;

  const handleFinish = async () => {
    setIsSaving(true);
    try {
      if (onFinish) {
        await onFinish(data);
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <Church className="w-5 h-5 text-crimson-700" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                New Parish
              </h2>
              <p className="text-xs text-gray-400">Step {step} of {STEPS.length}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            id="wizard-close"
            aria-label="Close wizard"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-4 flex items-center gap-2 border-b border-gray-100 flex-shrink-0">
          {STEPS.map((s, i) => (
            <div key={s.number} className="flex items-center gap-2 flex-1 min-w-0">
              <button
                onClick={() => step > s.number && setStep(s.number)}
                className={cn(
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 transition-colors',
                  step > s.number
                    ? 'bg-crimson-700 text-white cursor-pointer hover:bg-crimson-800'
                    : step === s.number
                    ? 'bg-crimson-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-default'
                )}
                aria-label={`Go to step ${s.number}`}
              >
                {step > s.number ? <Check className="w-3.5 h-3.5" /> : s.number}
              </button>
              <span
                className={cn(
                  'text-xs font-medium truncate',
                  step >= s.number ? 'text-gray-900' : 'text-gray-400'
                )}
              >
                {s.title}
              </span>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px bg-gray-200 mx-1 hidden sm:block" />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {step === 1 && (
            <Step1
              data={data.parishInfo}
              onChange={(parishInfo) => setData((d) => ({ ...d, parishInfo }))}
            />
          )}
          {step === 2 && (
            <PersonStep
              data={data.secretary}
              onChange={(secretary) => setData((d) => ({ ...d, secretary }))}
              idPrefix="secretary"
            />
          )}
          {step === 3 && (
            <PersonStep
              data={data.priest}
              onChange={(priest) => setData((d) => ({ ...d, priest }))}
              idPrefix="priest"
            />
          )}
          {step === 4 && <Step4Review data={data} />}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            id="wizard-prev"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </button>

          {isLastStep ? (
            <button
              onClick={() => void handleFinish()}
              disabled={isSaving}
              className="flex items-center gap-1.5 px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              id="wizard-finish"
            >
              <Check className="w-4 h-4" />
              {isSaving ? 'Saving…' : 'Finish'}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              disabled={!canAdvance}
              className="flex items-center gap-1.5 px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              id="wizard-next"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
