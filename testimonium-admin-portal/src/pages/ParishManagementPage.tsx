import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, Pencil, Archive, X, Check, Church } from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { NewParishWizard, type WizardData } from '@/components/parish-management/NewParishWizard';
import { ParishManagementService } from '@/services/ParishManagementService';
import { UserManagementService } from '@/services/UserManagementService';
import { SearchableDropdown, type DropdownOption } from '@/components/ui/SearchableDropdown';
import { cn } from '@/utils/cn';
import type { Parish, ParishType, ParishStatus } from '@/types';

// ─── Shared form helpers ──────────────────────────────────────────────────────

const inputCls =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all bg-white';

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
      <label
        htmlFor={id}
        className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide"
      >
        {label} {required && <span className="text-crimson-700">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── Status badge for parishes ────────────────────────────────────────────────

const parishStatusStyles: Record<ParishStatus, string> = {
  Active: 'bg-green-50 text-green-700 border border-green-200',
  Inactive: 'bg-amber-50 text-amber-700 border border-amber-200',
  Archived: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const parishStatusDot: Record<ParishStatus, string> = {
  Active: 'bg-green-500',
  Inactive: 'bg-amber-500',
  Archived: 'bg-gray-400',
};

function ParishStatusBadge({ status }: { status: ParishStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
        parishStatusStyles[status]
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', parishStatusDot[status])} />
      {status}
    </span>
  );
}

// ─── Type badge ───────────────────────────────────────────────────────────────

const typeStyles: Record<ParishType, string> = {
  Parish: 'bg-blue-50 text-blue-700',
  'Quasi-Parish': 'bg-purple-50 text-purple-700',
  'Mission Station': 'bg-orange-50 text-orange-700',
};

function ParishTypeBadge({ type }: { type: ParishType }) {
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', typeStyles[type])}>
      {type}
    </span>
  );
}

// ─── Filter options ───────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { label: 'All Types', value: 'all' },
  { label: 'Parish', value: 'Parish' },
  { label: 'Quasi-Parish', value: 'Quasi-Parish' },
  { label: 'Mission Station', value: 'Mission Station' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Archived', value: 'Archived' },
];

// ─── Edit Parish Modal ────────────────────────────────────────────────────────

interface EditParishFormData {
  name: string;
  type: ParishType | '';
  vicariate: string;
  priest: string;
  priestId: string | null;
  secretary: string;
  secretaryId: string | null;
  status: ParishStatus;
  patronSaint: string;
  address: string;
  contactNumber: string;
  email: string;
}

interface EditParishModalProps {
  parish: Parish;
  onSave: (data: Partial<Parish>) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

function EditParishModal({ parish, onSave, onClose, isSaving }: EditParishModalProps) {
  const [form, setForm] = useState<EditParishFormData>({
    name: parish.name,
    type: parish.type,
    vicariate: parish.vicariate,
    priest: parish.priest,
    priestId: parish.priestId ?? null,
    secretary: parish.secretary,
    secretaryId: parish.secretaryId ?? null,
    status: parish.status,
    patronSaint: parish.patronSaint ?? '',
    address: parish.address ?? '',
    contactNumber: parish.contactNumber ?? '',
    email: parish.email ?? '',
  });

  const [priests, setPriests] = useState<DropdownOption[]>([]);
  const [secretaries, setSecretaries] = useState<DropdownOption[]>([]);
  const [isLoadingStaff, setIsLoadingStaff] = useState(true);
  const [staffError, setStaffError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadStaff() {
      setIsLoadingStaff(true);
      setStaffError(null);
      try {
        const [priestsList, secretariesList] = await Promise.all([
          UserManagementService.getUsers({ role: 'PRIEST', assignableForParishId: parish.id }),
          UserManagementService.getUsers({ role: 'SECRETARY', assignableForParishId: parish.id }),
        ]);

        if (!active) return;

        const priestOptions: DropdownOption[] = priestsList.map((u) => ({
          id: u.id,
          name: u.name,
          secondaryText: u.email,
          badge: u.status !== 'Active' ? `(${u.status})` : undefined,
        }));

        const secretaryOptions: DropdownOption[] = secretariesList.map((u) => ({
          id: u.id,
          name: u.name,
          secondaryText: u.email,
          badge: u.status !== 'Active' ? `(${u.status})` : undefined,
        }));

        // Preserve current selection: ensure current priest is in options even if inactive/unassigned
        if (parish.priestId && !priestOptions.some((opt) => opt.id === parish.priestId)) {
          priestOptions.push({
            id: parish.priestId,
            name: parish.priestName || parish.priest || 'Assigned Priest',
            badge: '(Currently Assigned)',
          });
        }

        // Preserve current selection: ensure current secretary is in options even if inactive/unassigned
        if (parish.secretaryId && !secretaryOptions.some((opt) => opt.id === parish.secretaryId)) {
          secretaryOptions.push({
            id: parish.secretaryId,
            name: parish.secretaryName || parish.secretary || 'Assigned Secretary',
            badge: '(Currently Assigned)',
          });
        }

        setPriests(priestOptions);
        setSecretaries(secretaryOptions);
      } catch (err: any) {
        console.error('Failed to load assignable staff:', err);
        if (active) {
          setStaffError('Failed to load parish staff directory');
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
  }, [parish.id, parish.priestId, parish.priestName, parish.priest, parish.secretaryId, parish.secretaryName, parish.secretary]);

  const set =
    (field: keyof EditParishFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const canSubmit = Boolean(form.name && form.type && form.vicariate) && !isLoadingStaff;

  const handleSave = async () => {
    if (!form.type) return;
    await onSave({
      name: form.name,
      type: form.type as ParishType,
      vicariate: form.vicariate,
      priestId: form.priestId,
      secretaryId: form.secretaryId,
      status: form.status,
      patronSaint: form.patronSaint || undefined,
      address: form.address || undefined,
      contactNumber: form.contactNumber || undefined,
      email: form.email || undefined,
    });
  };

  return (
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
                Edit Parish
              </h2>
              <p className="text-xs text-gray-400 max-w-[260px] truncate">{parish.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            id="edit-parish-modal-close"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 overflow-y-auto flex-1 space-y-4">
          {staffError && (
            <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-150 rounded-lg p-3">
              {staffError}
            </div>
          )}

          <FormField label="Parish Name" id="ep-name" required>
            <input id="ep-name" className={inputCls} value={form.name} onChange={set('name')} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Parish Type" id="ep-type" required>
              <select id="ep-type" className={inputCls} value={form.type} onChange={set('type')}>
                <option value="">Select type...</option>
                <option value="Parish">Parish</option>
                <option value="Quasi-Parish">Quasi-Parish</option>
                <option value="Mission Station">Mission Station</option>
              </select>
            </FormField>

            <FormField label="Status" id="ep-status" required>
              <select id="ep-status" className={inputCls} value={form.status} onChange={set('status')}>
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Archived">Archived</option>
              </select>
            </FormField>
          </div>

          <FormField label="Vicariate" id="ep-vicariate" required>
            <select id="ep-vicariate" className={inputCls} value={form.vicariate} onChange={set('vicariate')}>
              <option value="Vicariate of Canlaon">Vicariate of Canlaon</option>
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Assigned Priest" id="ep-priest">
              <SearchableDropdown
                id="ep-priest"
                options={priests}
                selectedValue={form.priestId}
                onChange={(val) => setForm((prev) => ({ ...prev, priestId: val }))}
                placeholder="Select priest..."
                searchPlaceholder="Search priests..."
                emptyMessage="No available priests"
                loading={isLoadingStaff}
              />
            </FormField>
            <FormField label="Assigned Secretary" id="ep-secretary">
              <SearchableDropdown
                id="ep-secretary"
                options={secretaries}
                selectedValue={form.secretaryId}
                onChange={(val) => setForm((prev) => ({ ...prev, secretaryId: val }))}
                placeholder="Select secretary..."
                searchPlaceholder="Search secretaries..."
                emptyMessage="No available secretaries"
                loading={isLoadingStaff}
              />
            </FormField>
          </div>

          <FormField label="Patron Saint" id="ep-patron">
            <input id="ep-patron" className={inputCls} placeholder="e.g. St. Joseph" value={form.patronSaint} onChange={set('patronSaint')} />
          </FormField>

          <FormField label="Address" id="ep-address">
            <input id="ep-address" className={inputCls} placeholder="Street, Barangay, City" value={form.address} onChange={set('address')} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Contact Number" id="ep-contact">
              <input id="ep-contact" className={inputCls} placeholder="09XXXXXXXXX" value={form.contactNumber} onChange={set('contactNumber')} />
            </FormField>
            <FormField label="Email" id="ep-email">
              <input id="ep-email" type="email" className={inputCls} placeholder="parish@diocese.org" value={form.email} onChange={set('email')} />
            </FormField>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            id="edit-parish-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSave()}
            disabled={!canSubmit || isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            id="edit-parish-save"
          >
            <Check className="w-4 h-4" />
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast notification ───────────────────────────────────────────────────────

function Toast({ message, type }: { message: string; type: 'success' | 'error' }) {
  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-medium',
        type === 'success' ? 'bg-green-700 text-white' : 'bg-red-700 text-white'
      )}
    >
      <Check className="w-4 h-4 flex-shrink-0" />
      {message}
    </div>
  );
}

// ─── ParishManagementPage ─────────────────────────────────────────────────────

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; parish: Parish };

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export function ParishManagementPage() {
  const [parishes, setParishes] = useState<Parish[]>([]);
  const [search, setSearch] = useState('');
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss toast after 3 s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') =>
    setToast({ message, type });

  const fetchParishes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await ParishManagementService.getParishes({ search, type, status });
      setParishes(result);
    } catch (err: any) {
      console.error('Failed to load parishes:', err);
      setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [search, type, status]);

  useEffect(() => {
    void fetchParishes();
  }, [fetchParishes]);

  // ── Wizard finish → addParish ──────────────────────────────────────────────

  const handleWizardFinish = async (data: WizardData) => {
    const { parishInfo, priest, secretary } = data;
    await ParishManagementService.addParish({
      name: parishInfo.name,
      type: parishInfo.type as ParishType,
      vicariate: parishInfo.vicariate,
      priest: priest.fullName,
      secretary: secretary.fullName,
      patronSaint: parishInfo.patronSaint || undefined,
      address: parishInfo.address || undefined,
      contactNumber: parishInfo.contactNumber || undefined,
      email: parishInfo.email || undefined,
    });
    // Auto account creation for Secretary
    await UserManagementService.addUser({
      name: secretary.fullName,
      email: secretary.email,
      role: 'SECRETARY',
      parish: parishInfo.name,
    });
    // Auto account creation for Priest
    await UserManagementService.addUser({
      name: priest.fullName,
      email: priest.email,
      role: 'PRIEST',
      parish: parishInfo.name,
    });
    showToast('Parish added successfully.');
    void fetchParishes();
  };

  // ── Edit parish ────────────────────────────────────────────────────────────

  const handleEditSave = async (parishId: string, data: Partial<Parish>) => {
    setIsSaving(true);
    try {
      await ParishManagementService.editParish(parishId, data);
      setModal({ type: 'none' });
      showToast('Parish updated successfully.');
      void fetchParishes();
    } catch {
      showToast('Failed to update parish.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Archive parish ─────────────────────────────────────────────────────────

  const handleArchive = async (parish: Parish) => {
    await ParishManagementService.archiveParish(parish.id);
    showToast(`"${parish.name}" archived.`);
    void fetchParishes();
  };

  return (
    <div>
      <PageHeader
        title="Parish Management"
        subtitle="Manage all parishes, quasi-parishes, and mission stations across the Diocese."
        actions={
          <button
            id="add-parish-btn"
            onClick={() => setModal({ type: 'add' })}
            className="flex items-center gap-2 px-4 py-2.5 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Parish
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            placeholder="Search by name, priest, or secretary..."
            value={search}
            onChange={setSearch}
            className="flex-1"
          />
          <div className="flex gap-3">
            {/* Type filter */}
            <div className="relative">
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[160px]"
                id="filter-parish-type"
                aria-label="Filter by parish type"
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>

            {/* Status filter */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[140px]"
                id="filter-parish-status"
                aria-label="Filter by parish status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message="Loading parishes..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchParishes} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {parishes.length === 0 ? (
            <EmptyState title="No parishes found" description="Try adjusting your search or filter criteria." />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Parish Name</th>
                    <th>Type</th>
                    <th>Assigned Priest</th>
                    <th>Assigned Secretary</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {parishes.map((parish) => (
                    <tr key={parish.id}>
                      <td className="font-semibold text-gray-900">{parish.name}</td>
                      <td><ParishTypeBadge type={parish.type} /></td>
                      <td className="text-gray-700">{parish.priest}</td>
                      <td className="text-gray-700">{parish.secretary}</td>
                      <td><ParishStatusBadge status={parish.status} /></td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            id={`edit-parish-${parish.id}`}
                            onClick={() => setModal({ type: 'edit', parish })}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                            aria-label={`Edit ${parish.name}`}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Edit
                          </button>
                          {parish.status !== 'Archived' && (
                            <button
                              id={`archive-parish-${parish.id}`}
                              onClick={() => void handleArchive(parish)}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors"
                              aria-label={`Archive ${parish.name}`}
                            >
                              <Archive className="w-3.5 h-3.5" />
                              Archive
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Modals ── */}

      {modal.type === 'add' && (
        <NewParishWizard
          onClose={() => setModal({ type: 'none' })}
          onFinish={handleWizardFinish}
        />
      )}

      {modal.type === 'edit' && (
        <EditParishModal
          parish={modal.parish}
          onSave={(data) => handleEditSave(modal.parish.id, data)}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
