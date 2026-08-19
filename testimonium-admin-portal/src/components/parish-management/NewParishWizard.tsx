import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ChevronRight, ChevronLeft, Check, Church, User, AlertCircle } from 'lucide-react';
import { cn } from '@/utils/cn';
import { SearchableDropdown, type DropdownOption } from '@/components/ui/SearchableDropdown';
import { UserManagementService } from '@/services/UserManagementService';
import type {
  PersonData,
  StaffAssignmentMode,
  StaffAssignmentConfig,
} from '@/providers/interfaces';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ParishInfoData {
  name: string;
  type: 'Parish' | 'Quasi-Parish' | 'Mission Station' | '';
  vicariate: string;
  municipalityCity: string;
  feastDay: string;
  patronSaint: string;
  address: string;
  contactNumber: string;
  email: string;
}

export interface WizardData {
  parishInfo: ParishInfoData;
  priest: StaffAssignmentConfig;
  secretary: StaffAssignmentConfig;
}

export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export const getDaysInMonth = (month: string): number => {
  switch (month) {
    case 'February':
      return 29;
    case 'April':
    case 'June':
    case 'September':
    case 'November':
      return 30;
    default:
      return 31;
  }
};

const EMPTY_PARISH_INFO: ParishInfoData = {
  name: '',
  type: '',
  vicariate: '',
  municipalityCity: '',
  feastDay: '',
  patronSaint: '',
  address: '',
  contactNumber: '',
  email: '',
};

const EMPTY_PERSON: PersonData = { fullName: '', email: '', contactNumber: '' };

const DEFAULT_PRIEST_CONFIG: StaffAssignmentConfig = {
  mode: 'none',
  existingUserId: null,
  newUserData: null,
};

const DEFAULT_SECRETARY_CONFIG: StaffAssignmentConfig = {
  mode: 'none',
  existingUserId: null,
  newUserData: null,
};

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

// ─── Step 1: Parish Details ───────────────────────────────────────────────────

function Step1({ data, onChange }: { data: ParishInfoData; onChange: (d: ParishInfoData) => void }) {
  const set = (field: keyof ParishInfoData) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...data, [field]: e.target.value });

  // Parse existing feastDay into month and day
  const parts = data.feastDay ? data.feastDay.split(' ') : [];
  const selectedMonth = parts.length > 0 && MONTHS.includes(parts[0]) ? parts[0] : '';
  const selectedDay = parts.length > 1 ? parts[1] : '';

  const maxDays = selectedMonth ? getDaysInMonth(selectedMonth) : 31;
  const dayOptions = Array.from({ length: maxDays }, (_, i) => String(i + 1));

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newMonth = e.target.value;
    if (!newMonth) {
      onChange({ ...data, feastDay: '' });
      return;
    }
    const max = getDaysInMonth(newMonth);
    let day = selectedDay || '1';
    if (parseInt(day, 10) > max) {
      day = String(max);
    }
    onChange({ ...data, feastDay: `${newMonth} ${day}` });
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDay = e.target.value;
    const month = selectedMonth || MONTHS[0];
    if (!newDay) {
      onChange({ ...data, feastDay: '' });
      return;
    }
    onChange({ ...data, feastDay: `${month} ${newDay}` });
  };

  return (
    <div className="space-y-4">
      <FormField label="Parish Name" id="parish-name" required>
        <input
          id="parish-name"
          className={inputCls}
          placeholder="e.g. St. Joseph the Worker Parish"
          value={data.name}
          onChange={set('name')}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
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
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Municipality / City" id="parish-municipality" required>
          <input
            id="parish-municipality"
            className={inputCls}
            placeholder="e.g. Canlaon City"
            value={data.municipalityCity}
            onChange={set('municipalityCity')}
          />
        </FormField>

        <FormField label="Feast Date" id="parish-feast-month" required>
          <div className="grid grid-cols-2 gap-2">
            <select
              id="parish-feast-month"
              className={inputCls}
              value={selectedMonth}
              onChange={handleMonthChange}
            >
              <option value="">Month...</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
            <select
              id="parish-feast-day"
              className={inputCls}
              value={selectedDay}
              onChange={handleDayChange}
              disabled={!selectedMonth}
            >
              <option value="">Day...</option>
              {dayOptions.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </FormField>
      </div>

      <FormField label="Patron Saint" id="parish-patron">
        <input
          id="parish-patron"
          className={inputCls}
          placeholder="e.g. St. Joseph"
          value={data.patronSaint}
          onChange={set('patronSaint')}
        />
      </FormField>

      <FormField label="Address" id="parish-address">
        <input
          id="parish-address"
          className={inputCls}
          placeholder="Street, Barangay, City"
          value={data.address}
          onChange={set('address')}
        />
      </FormField>

      <div className="grid grid-cols-2 gap-3">
        <FormField label="Contact Number" id="parish-contact">
          <input
            id="parish-contact"
            className={inputCls}
            placeholder="09XXXXXXXXX"
            value={data.contactNumber}
            onChange={set('contactNumber')}
          />
        </FormField>
        <FormField label="Email" id="parish-email">
          <input
            id="parish-email"
            type="email"
            className={inputCls}
            placeholder="parish@diocese.org"
            value={data.email}
            onChange={set('email')}
          />
        </FormField>
      </div>
    </div>
  );
}

// ─── Step 2: Optional Staff Section ───────────────────────────────────────────

interface StaffSectionProps {
  title: string;
  roleDescription: string;
  config: StaffAssignmentConfig;
  onChange: (config: StaffAssignmentConfig) => void;
  options: DropdownOption[];
  isLoadingOptions: boolean;
  optionsError: string | null;
  idPrefix: string;
}

function StaffSection({
  title,
  roleDescription,
  config,
  onChange,
  options,
  isLoadingOptions,
  optionsError,
  idPrefix,
}: StaffSectionProps) {
  const setMode = (mode: StaffAssignmentMode) => {
    onChange({
      ...config,
      mode,
    });
  };

  const setExistingUserId = (val: string | null) => {
    onChange({
      ...config,
      existingUserId: val,
    });
  };

  const setNewUserData = (field: keyof PersonData, value: string) => {
    onChange({
      ...config,
      newUserData: {
        ...(config.newUserData || { ...EMPTY_PERSON }),
        [field]: value,
      },
    });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white space-y-3.5 shadow-xs">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <User className="w-4 h-4 text-crimson-700" />
            {title}
          </h3>
          <p className="text-xs text-gray-500">{roleDescription}</p>
        </div>
      </div>

      {/* Segmented Mode Selector */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-lg text-xs font-medium">
        <button
          type="button"
          onClick={() => setMode('none')}
          className={cn(
            'py-1.5 px-2 rounded-md transition-all text-center',
            config.mode === 'none'
              ? 'bg-white text-gray-900 font-semibold shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          )}
          id={`${idPrefix}-mode-none`}
        >
          Leave Unassigned
        </button>
        <button
          type="button"
          onClick={() => setMode('existing')}
          className={cn(
            'py-1.5 px-2 rounded-md transition-all text-center',
            config.mode === 'existing'
              ? 'bg-white text-gray-900 font-semibold shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          )}
          id={`${idPrefix}-mode-existing`}
        >
          Assign Existing
        </button>
        <button
          type="button"
          onClick={() => setMode('new')}
          className={cn(
            'py-1.5 px-2 rounded-md transition-all text-center',
            config.mode === 'new'
              ? 'bg-white text-gray-900 font-semibold shadow-xs'
              : 'text-gray-600 hover:text-gray-900'
          )}
          id={`${idPrefix}-mode-new`}
        >
          Create New Account
        </button>
      </div>

      {/* Mode: None */}
      {config.mode === 'none' && (
        <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3 border border-gray-100">
          No {title.toLowerCase()} will be assigned at creation. You can assign staff anytime from Parish Management or User Management.
        </div>
      )}

      {/* Mode: Existing */}
      {config.mode === 'existing' && (
        <div className="space-y-2 pt-1">
          {optionsError && (
            <p className="text-xs text-red-600 font-medium">{optionsError}</p>
          )}
          <FormField label={`Select Existing ${title}`} id={`${idPrefix}-existing-select`} required>
            <SearchableDropdown
              id={`${idPrefix}-existing-select`}
              options={options}
              selectedValue={config.existingUserId || null}
              onChange={setExistingUserId}
              placeholder={`Choose ${title.toLowerCase()}...`}
              searchPlaceholder={`Search ${title.toLowerCase()}s by name or email...`}
              emptyMessage={`No unassigned ${title.toLowerCase()}s available`}
              loading={isLoadingOptions}
            />
          </FormField>
          {options.length === 0 && !isLoadingOptions && (
            <p className="text-xs text-amber-700 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
              Note: All registered {title.toLowerCase()}s are currently assigned to other parishes. You may select &quot;Create New Account&quot; or leave unassigned.
            </p>
          )}
        </div>
      )}

      {/* Mode: New */}
      {config.mode === 'new' && (
        <div className="space-y-3 pt-1">
          <FormField label="Full Name" id={`${idPrefix}-new-name`} required>
            <input
              id={`${idPrefix}-new-name`}
              className={inputCls}
              placeholder="Full legal name"
              value={config.newUserData?.fullName || ''}
              onChange={(e) => setNewUserData('fullName', e.target.value)}
            />
          </FormField>
          <FormField label="Email Address" id={`${idPrefix}-new-email`} required>
            <input
              id={`${idPrefix}-new-email`}
              type="email"
              className={inputCls}
              placeholder="user@diocese.org"
              value={config.newUserData?.email || ''}
              onChange={(e) => setNewUserData('email', e.target.value)}
            />
          </FormField>
          <FormField label="Contact Number" id={`${idPrefix}-new-contact`}>
            <input
              id={`${idPrefix}-new-contact`}
              className={inputCls}
              placeholder="09XXXXXXXXX"
              value={config.newUserData?.contactNumber || ''}
              onChange={(e) => setNewUserData('contactNumber', e.target.value)}
            />
          </FormField>
          <p className="text-xs text-gray-500">
            An onboarding email and password setup link will be automatically generated for this account.
          </p>
        </div>
      )}
    </div>
  );
}

function Step2Staff({
  data,
  onChange,
  priestOptions,
  secretaryOptions,
  isLoadingStaff,
  staffError,
}: {
  data: WizardData;
  onChange: (d: WizardData) => void;
  priestOptions: DropdownOption[];
  secretaryOptions: DropdownOption[];
  isLoadingStaff: boolean;
  staffError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50/60 border border-blue-100 rounded-lg p-3 text-xs text-blue-800">
        Staff assignment is <strong>optional</strong>. You can assign existing clergy/staff, provision new accounts, or leave roles unassigned.
      </div>

      {staffError && (
        <div className="text-xs text-red-600 bg-red-50 p-2.5 rounded-lg border border-red-150">
          {staffError}
        </div>
      )}

      {/* Priest Section */}
      <StaffSection
        title="Parish Priest"
        roleDescription="Assign an appointed pastor or leave unassigned"
        config={data.priest}
        onChange={(priest) => onChange({ ...data, priest })}
        options={priestOptions}
        isLoadingOptions={isLoadingStaff}
        optionsError={staffError}
        idPrefix="priest"
      />

      {/* Secretary Section */}
      <StaffSection
        title="Parish Secretary"
        roleDescription="Assign an administrative secretary or leave unassigned"
        config={data.secretary}
        onChange={(secretary) => onChange({ ...data, secretary })}
        options={secretaryOptions}
        isLoadingOptions={isLoadingStaff}
        optionsError={staffError}
        idPrefix="secretary"
      />
    </div>
  );
}

// ─── Step 3: Review & Finish ──────────────────────────────────────────────────

function Step3Review({
  data,
  priestOptions,
  secretaryOptions,
  errorMessage,
}: {
  data: WizardData;
  priestOptions: DropdownOption[];
  secretaryOptions: DropdownOption[];
  errorMessage: string | null;
}) {
  function Row({ label, value, badge }: { label: string; value: string; badge?: string }) {
    return (
      <div className="flex items-center justify-between text-sm py-0.5">
        <span className="text-gray-500 w-36 flex-shrink-0">{label}</span>
        <span className="text-gray-900 font-medium flex items-center gap-1.5 truncate">
          {value || '—'}
          {badge && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-gray-200 text-gray-700">
              {badge}
            </span>
          )}
        </span>
      </div>
    );
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div>
        <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">{title}</h4>
        <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-gray-100">{children}</div>
      </div>
    );
  }

  const formatStaffSummary = (
    config: StaffAssignmentConfig,
    options: DropdownOption[]
  ): { value: string; badge?: string } => {
    if (config.mode === 'none') {
      return { value: 'Unassigned', badge: 'None' };
    }
    if (config.mode === 'existing') {
      const found = options.find((o) => o.id === config.existingUserId);
      return {
        value: found ? `${found.name} (${found.secondaryText || 'Assigned'})` : 'Existing Account Selected',
        badge: 'Existing',
      };
    }
    if (config.mode === 'new' && config.newUserData) {
      return {
        value: `${config.newUserData.fullName} (${config.newUserData.email})`,
        badge: 'New Account',
      };
    }
    return { value: 'Unassigned' };
  };

  const priestSummary = formatStaffSummary(data.priest, priestOptions);
  const secretarySummary = formatStaffSummary(data.secretary, secretaryOptions);

  return (
    <div className="space-y-4">
      {errorMessage && (
        <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Parish creation could not be completed</p>
            <p className="mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      <Section title="Parish Information">
        <Row label="Name" value={data.parishInfo.name} />
        <Row label="Type" value={data.parishInfo.type} />
        <Row label="Vicariate" value={data.parishInfo.vicariate} />
        <Row label="Municipality / City" value={data.parishInfo.municipalityCity} />
        <Row label="Feast Date" value={data.parishInfo.feastDay} />
        <Row label="Patron Saint" value={data.parishInfo.patronSaint} />
        <Row label="Address" value={data.parishInfo.address} />
        <Row label="Contact Number" value={data.parishInfo.contactNumber} />
        <Row label="Email" value={data.parishInfo.email} />
      </Section>

      <Section title="Staff Assignments">
        <Row label="Parish Priest" value={priestSummary.value} badge={priestSummary.badge} />
        <Row label="Parish Secretary" value={secretarySummary.value} badge={secretarySummary.badge} />
      </Section>
    </div>
  );
}

// ─── Step metadata ────────────────────────────────────────────────────────────

const STEPS = [
  { number: 1, title: 'Parish Details' },
  { number: 2, title: 'Staff Assignment' },
  { number: 3, title: 'Review & Finish' },
];

// ─── NewParishWizard ──────────────────────────────────────────────────────────

interface NewParishWizardProps {
  onClose: () => void;
  onFinish?: (data: WizardData) => Promise<void>;
}

export function NewParishWizard({ onClose, onFinish }: NewParishWizardProps) {
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [data, setData] = useState<WizardData>({
    parishInfo: { ...EMPTY_PARISH_INFO },
    priest: { ...DEFAULT_PRIEST_CONFIG },
    secretary: { ...DEFAULT_SECRETARY_CONFIG },
  });

  const [priestOptions, setPriestOptions] = useState<DropdownOption[]>([]);
  const [secretaryOptions, setSecretaryOptions] = useState<DropdownOption[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(false);
  const [staffError, setStaffError] = useState<string | null>(null);

  // Load assignable staff on mount
  useEffect(() => {
    let active = true;
    async function loadStaff() {
      setIsLoadingStaff(true);
      setStaffError(null);
      try {
        const [priestsList, secretariesList] = await Promise.all([
          UserManagementService.getUsers({ role: 'PRIEST', assignableForParishId: '' }),
          UserManagementService.getUsers({ role: 'SECRETARY', assignableForParishId: '' }),
        ]);

        if (!active) return;

        setPriestOptions(
          priestsList.map((u) => ({
            id: u.id,
            name: u.name,
            secondaryText: u.email,
            badge: u.parish && u.parish !== 'None' ? `(${u.parish})` : undefined,
          }))
        );

        setSecretaryOptions(
          secretariesList.map((u) => ({
            id: u.id,
            name: u.name,
            secondaryText: u.email,
            badge: u.parish && u.parish !== 'None' ? `(${u.parish})` : undefined,
          }))
        );
      } catch (err: any) {
        console.error('Failed to load assignable staff directory:', err);
        if (active) {
          setStaffError('Failed to load available clergy and staff');
        }
      } finally {
        if (active) {
          setIsLoadingStaff(false);
        }
      }
    }
    void loadStaff();
    return () => {
      active = false;
    };
  }, []);

  const isLastStep = step === STEPS.length;

  // Validation rules per step
  const isPriestValid =
    data.priest.mode === 'none' ||
    (data.priest.mode === 'existing' && Boolean(data.priest.existingUserId)) ||
    (data.priest.mode === 'new' &&
      Boolean(
        data.priest.newUserData?.fullName.trim() &&
        data.priest.newUserData?.email.trim()
      ));

  const isSecretaryValid =
    data.secretary.mode === 'none' ||
    (data.secretary.mode === 'existing' && Boolean(data.secretary.existingUserId)) ||
    (data.secretary.mode === 'new' &&
      Boolean(
        data.secretary.newUserData?.fullName.trim() &&
        data.secretary.newUserData?.email.trim()
      ));

  const canAdvance =
    step === 1
      ? Boolean(
          data.parishInfo.name.trim() &&
          data.parishInfo.type &&
          data.parishInfo.vicariate &&
          data.parishInfo.municipalityCity.trim() &&
          data.parishInfo.feastDay.trim()
        )
      : step === 2
      ? isPriestValid && isSecretaryValid
      : true;

  const handleFinish = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      const sanitizedData: WizardData = {
        parishInfo: {
          ...data.parishInfo,
          name: data.parishInfo.name.trim(),
          municipalityCity: data.parishInfo.municipalityCity.trim(),
          feastDay: data.parishInfo.feastDay.trim(),
          patronSaint: data.parishInfo.patronSaint.trim(),
          address: data.parishInfo.address.trim(),
          contactNumber: data.parishInfo.contactNumber.trim(),
          email: data.parishInfo.email.trim(),
        },
        priest: {
          mode: data.priest.mode,
          existingUserId: data.priest.mode === 'existing' ? data.priest.existingUserId : null,
          newUserData:
            data.priest.mode === 'new' && data.priest.newUserData
              ? {
                  fullName: data.priest.newUserData.fullName.trim(),
                  email: data.priest.newUserData.email.trim(),
                  contactNumber: data.priest.newUserData.contactNumber?.trim() || undefined,
                }
              : null,
        },
        secretary: {
          mode: data.secretary.mode,
          existingUserId: data.secretary.mode === 'existing' ? data.secretary.existingUserId : null,
          newUserData:
            data.secretary.mode === 'new' && data.secretary.newUserData
              ? {
                  fullName: data.secretary.newUserData.fullName.trim(),
                  email: data.secretary.newUserData.email.trim(),
                  contactNumber: data.secretary.newUserData.contactNumber?.trim() || undefined,
                }
              : null,
        },
      };

      if (onFinish) {
        await onFinish(sanitizedData);
      }
      onClose();
    } catch (err: any) {
      console.error('Parish creation failed:', err);
      const responseData = err?.response?.data;
      let serverMsg =
        responseData?.message ||
        err?.message ||
        'An error occurred while creating the parish. Please check your inputs and try again.';

      if (responseData?.errors && Array.isArray(responseData.errors) && responseData.errors.length > 0) {
        const errorDetails = responseData.errors
          .map((e: any) => `${e.field ? `${e.field}: ` : ''}${e.message}`)
          .join(', ');
        serverMsg = `${responseData.message || 'Validation Error'}: ${errorDetails}`;
      }

      setErrorMessage(serverMsg);
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => !isSaving && e.target === e.currentTarget && onClose()}
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
            disabled={isSaving}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
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
                onClick={() => !isSaving && step > s.number && setStep(s.number)}
                disabled={isSaving || step <= s.number}
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
            <Step2Staff
              data={data}
              onChange={setData}
              priestOptions={priestOptions}
              secretaryOptions={secretaryOptions}
              isLoadingStaff={isLoadingStaff}
              staffError={staffError}
            />
          )}
          {step === 3 && (
            <Step3Review
              data={data}
              priestOptions={priestOptions}
              secretaryOptions={secretaryOptions}
              errorMessage={errorMessage}
            />
          )}
        </div>

        {/* Footer actions */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1 || isSaving}
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
              className="flex items-center gap-1.5 px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-xs"
              id="wizard-finish"
            >
              {isSaving ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Creating Parish…
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Create Parish
                </>
              )}
            </button>
          ) : (
            <button
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              disabled={!canAdvance || isSaving}
              className="flex items-center gap-1.5 px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-xs"
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
