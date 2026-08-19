import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Plus,
  ChevronDown,
  Pencil,
  UserX,
  KeyRound,
  X,
  Check,
  UserPlus,
  Copy,
  ExternalLink,
  Users,
  Shield,
  Eye,
  Lock,
  Calendar,
  Phone,
  MapPin,
  Mail,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/common/LoadingState';
import { ErrorState } from '@/components/common/ErrorState';
import { UserManagementService, type AddUserPayload } from '@/services/UserManagementService';
import { ParishManagementService } from '@/services/ParishManagementService';
import { cn } from '@/utils/cn';
import type { ManagedUser, ManagedUserRole, ManagedUserStatus } from '@/types';
import { Tooltip } from '@/components/ui/Tooltip';


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

// ─── Role badge ───────────────────────────────────────────────────────────────

const roleLabels: Record<ManagedUserRole, string> = {
  DIOCESE_COORDINATOR: 'Diocese Coordinator',
  SECRETARY: 'Secretary',
  PRIEST: 'Parish Priest',
  ASSISTANT_PRIEST: 'Assistant Priest',
  PARISHIONER: 'Parishioner',
};

const roleStyles: Record<ManagedUserRole, string> = {
  DIOCESE_COORDINATOR: 'bg-red-50 text-crimson-700',
  SECRETARY: 'bg-blue-50 text-blue-700',
  PRIEST: 'bg-purple-50 text-purple-700',
  ASSISTANT_PRIEST: 'bg-indigo-50 text-indigo-700',
  PARISHIONER: 'bg-emerald-50 text-emerald-700',
};

function RoleBadge({ role }: { role: ManagedUserRole }) {
  return (
    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', roleStyles[role])}>
      {roleLabels[role]}
    </span>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const userStatusStyles: Record<ManagedUserStatus, string> = {
  Active: 'bg-green-50 text-green-700 border border-green-200',
  Inactive: 'bg-amber-50 text-amber-700 border border-amber-200',
  Disabled: 'bg-gray-100 text-gray-500 border border-gray-200',
};

const userStatusDot: Record<ManagedUserStatus, string> = {
  Active: 'bg-green-500',
  Inactive: 'bg-amber-500',
  Disabled: 'bg-gray-400',
};

function UserStatusBadge({ status }: { status: ManagedUserStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
        userStatusStyles[status]
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', userStatusDot[status])} />
      {status}
    </span>
  );
}

// ─── Filter options ───────────────────────────────────────────────────────────

const STAFF_ROLE_OPTIONS = [
  { label: 'All Staff Roles', value: 'all' },
  { label: 'Diocese Coordinator', value: 'DIOCESE_COORDINATOR' },
  { label: 'Secretary', value: 'SECRETARY' },
  { label: 'Parish Priest', value: 'PRIEST' },
  { label: 'Assistant Priest', value: 'ASSISTANT_PRIEST' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Disabled', value: 'Disabled' },
];

// Helper to format ISO dates
function formatDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

// ─── Add / Edit Staff Modal ───────────────────────────────────────────────────

interface StaffFormData {
  name: string;
  email: string;
  role: ManagedUserRole | '';
  parish: string;
}

const EMPTY_STAFF_FORM: StaffFormData = { name: '', email: '', role: '', parish: '' };

interface StaffModalProps {
  user: ManagedUser | null;
  onSave: (data: StaffFormData) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

function StaffUserModal({ user, onSave, onClose, isSaving }: StaffModalProps) {
  const isEdit = user !== null;
  const [form, setForm] = useState<StaffFormData>(
    isEdit
      ? { name: user.name, email: user.email, role: user.role, parish: user.parish }
      : { ...EMPTY_STAFF_FORM }
  );

  const [parishes, setParishes] = useState<string[]>([]);

  useEffect(() => {
    ParishManagementService.getParishes()
      .then((list) => setParishes(list.map((p) => p.name)))
      .catch((err) => console.error('Failed to load parishes:', err));
  }, []);

  const set =
    (field: keyof StaffFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const canSubmit = Boolean(form.name && form.email && form.role && form.parish);

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-crimson-700" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                {isEdit ? 'Edit Staff User' : 'Add Staff User'}
              </h2>
              <p className="text-xs text-gray-400">
                {isEdit ? `Editing ${user.name}` : 'Create a new diocesan staff account'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            id="user-modal-close"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="px-6 py-5 space-y-4">
          <FormField label="Full Name" id="um-name" required>
            <input
              id="um-name"
              className={inputCls}
              placeholder="Full legal name"
              value={form.name}
              onChange={set('name')}
            />
          </FormField>

          <FormField label="Email Address" id="um-email" required>
            <input
              id="um-email"
              type="email"
              className={inputCls}
              placeholder="user@diocese.org"
              value={form.email}
              onChange={set('email')}
            />
          </FormField>

          <FormField label="Staff Role" id="um-role" required>
            <select
              id="um-role"
              className={inputCls}
              value={form.role}
              onChange={set('role')}
            >
              <option value="">Select role...</option>
              <option value="DIOCESE_COORDINATOR">Diocese Coordinator</option>
              <option value="SECRETARY">Secretary</option>
              <option value="PRIEST">Parish Priest</option>
              <option value="ASSISTANT_PRIEST">Assistant Priest</option>
            </select>
          </FormField>

          <FormField label="Assigned Parish" id="um-parish" required>
            <select
              id="um-parish"
              className={inputCls}
              value={form.parish}
              onChange={set('parish')}
            >
              <option value="">Select parish...</option>
              {parishes.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </FormField>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            id="user-modal-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => void onSave(form)}
            disabled={!canSubmit || isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            id="user-modal-save"
          >
            <Check className="w-4 h-4" />
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff User'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Dedicated Parishioner Edit Modal ─────────────────────────────────────────

interface ParishionerEditFormData {
  firstName: string;
  middleName: string;
  lastName: string;
  suffix: string;
  contactNumber: string;
  address: string;
}

interface ParishionerEditModalProps {
  user: ManagedUser;
  onSave: (data: ParishionerEditFormData) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

function ParishionerEditModal({ user, onSave, onClose, isSaving }: ParishionerEditModalProps) {
  // Parse name parts from user.name if separate fields are not populated
  const parseNameParts = (fullName: string) => {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { first: parts[0], middle: '', last: '', suffix: '' };
    if (parts.length === 2) return { first: parts[0], middle: '', last: parts[1], suffix: '' };
    const suffixes = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'Jr', 'Sr'];
    let suffix = '';
    let workParts = [...parts];
    if (suffixes.includes(workParts[workParts.length - 1])) {
      suffix = workParts.pop() || '';
    }
    const last = workParts.pop() || '';
    const first = workParts.shift() || '';
    const middle = workParts.join(' ');
    return { first, middle, last, suffix };
  };

  const initialParts = parseNameParts(user.name);

  const [form, setForm] = useState<ParishionerEditFormData>({
    firstName: user.firstName || initialParts.first,
    middleName: user.middleName || initialParts.middle,
    lastName: user.lastName || initialParts.last,
    suffix: user.suffix || initialParts.suffix,
    contactNumber: user.contactNumber || '',
    address: user.address || '',
  });

  const set =
    (field: keyof ParishionerEditFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const canSubmit = Boolean(form.firstName.trim() && form.lastName.trim());

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Pencil className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: 'Playfair Display, serif' }}
              >
                Edit Parishioner Profile
              </h2>
              <p className="text-xs text-gray-400">
                Update basic profile information for {user.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
            id="parishioner-edit-close"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Read-Only Account Identity Info */}
          <div className="p-3.5 bg-gray-50 border border-gray-150 rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="font-semibold uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                Immutable Account Details
              </span>
              <span className="text-[11px] text-gray-400">Protected Identity</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Email Address</span>
                <span className="font-medium text-gray-800 break-all">{user.email}</span>
              </div>
              <div>
                <span className="text-gray-400 block text-[10px] uppercase font-semibold">Date Registered</span>
                <span className="font-medium text-gray-800">{formatDate(user.registrationDate || user.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-3">
            <FormField label="First Name" id="pm-firstname" required>
              <input
                id="pm-firstname"
                className={inputCls}
                placeholder="Juan"
                value={form.firstName}
                onChange={set('firstName')}
              />
            </FormField>
            <FormField label="Middle Name" id="pm-middlename">
              <input
                id="pm-middlename"
                className={inputCls}
                placeholder="Protacio"
                value={form.middleName}
                onChange={set('middleName')}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <FormField label="Last Name" id="pm-lastname" required>
                <input
                  id="pm-lastname"
                  className={inputCls}
                  placeholder="Dela Cruz"
                  value={form.lastName}
                  onChange={set('lastName')}
                />
              </FormField>
            </div>
            <div>
              <FormField label="Suffix" id="pm-suffix">
                <input
                  id="pm-suffix"
                  className={inputCls}
                  placeholder="Jr. / III"
                  value={form.suffix}
                  onChange={set('suffix')}
                />
              </FormField>
            </div>
          </div>

          {/* Contact Number */}
          <FormField label="Contact Number" id="pm-contact">
            <input
              id="pm-contact"
              className={inputCls}
              placeholder="0917XXXXXXX"
              value={form.contactNumber}
              onChange={set('contactNumber')}
            />
          </FormField>

          {/* Address */}
          <FormField label="Complete Address / Barangay / Municipality" id="pm-address">
            <textarea
              id="pm-address"
              rows={2}
              className={cn(inputCls, 'resize-none')}
              placeholder="Street, Barangay, Municipality, Province"
              value={form.address}
              onChange={set('address')}
            />
          </FormField>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 bg-gray-50/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            id="parishioner-edit-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => void onSave(form)}
            disabled={!canSubmit || isSaving}
            className="flex items-center gap-2 px-5 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            id="parishioner-edit-save"
          >
            <Check className="w-4 h-4" />
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Parishioner Profile Detail Modal (View Profile) ──────────────────────────

interface ParishionerProfileModalProps {
  user: ManagedUser;
  onEdit: () => void;
  onClose: () => void;
}

function ParishionerProfileModal({ user, onEdit, onClose }: ParishionerProfileModalProps) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header Banner */}
        <div className="bg-[#7B1C2A] text-white px-6 pt-6 pb-5 flex items-start justify-between">
          <div className="flex items-center gap-3.5">
            <Avatar initials={user.avatarInitials} bgColor={user.avatarColor} size="lg" />
            <div>
              <h2 className="text-lg font-bold font-serif leading-tight">{user.name}</h2>
              <span className="inline-block mt-1 text-[11px] font-semibold uppercase tracking-wider bg-white/15 px-2 py-0.5 rounded-full">
                Parishioner Account
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-md transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Content */}
        <div className="p-6 space-y-4 text-sm">
          <div className="grid grid-cols-2 gap-4 pb-3 border-b border-gray-100">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                Account Status
              </span>
              <UserStatusBadge status={user.status} />
            </div>
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                Date Registered
              </span>
              <div className="flex items-center gap-1.5 text-xs text-gray-700 font-medium">
                <Calendar className="w-3.5 h-3.5 text-gray-400" />
                {formatDate(user.registrationDate || user.createdAt)}
              </div>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                Email Address
              </span>
              <div className="flex items-center gap-2 text-gray-800 font-medium p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span className="break-all">{user.email}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                Contact Number
              </span>
              <div className="flex items-center gap-2 text-gray-800 font-medium p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <span>{user.contactNumber || 'No contact number registered'}</span>
              </div>
            </div>

            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block mb-1">
                Address / Residence
              </span>
              <div className="flex items-start gap-2 text-gray-800 font-medium p-2.5 bg-gray-50 rounded-lg border border-gray-100">
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="leading-relaxed">{user.address || 'No address registered'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <button
            onClick={() => {
              onClose();
              onEdit();
            }}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-700 bg-white hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          >
            <Pencil className="w-3.5 h-3.5" />
            Edit Profile
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-white bg-gray-900 hover:bg-gray-800 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Disable Confirmation Modal ───────────────────────────────────────────────

function DisableConfirmModal({
  user,
  onConfirm,
  onClose,
  isSaving,
}: {
  user: ManagedUser;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
          <UserX className="w-6 h-6 text-amber-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Disable Account?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          <span className="font-medium text-gray-800">{user.name}</span> will lose access to their account. You can re-enable them at any time.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            id="disable-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={isSaving}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-semibold rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
            id="disable-confirm"
          >
            {isSaving ? 'Disabling…' : 'Disable Account'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Enable Confirmation Modal ────────────────────────────────────────────────

function EnableConfirmModal({
  user,
  onConfirm,
  onClose,
  isSaving,
}: {
  user: ManagedUser;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <UserPlus className="w-6 h-6 text-emerald-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Enable Account?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          <span className="font-medium text-gray-800">{user.name}</span> will regain access to their account.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            id="enable-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={isSaving}
            className="px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            id="enable-confirm"
          >
            {isSaving ? 'Enabling…' : 'Enable Account'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Reset Password Confirmation Modal ────────────────────────────────────────

function ResetPasswordModal({
  user,
  onConfirm,
  onClose,
  isSaving,
}: {
  user: ManagedUser;
  onConfirm: () => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
          <KeyRound className="w-6 h-6 text-blue-600" />
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          Reset Password?
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          A password reset link will be sent to{' '}
          <span className="font-medium text-gray-800">{user.email}</span>.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
            id="reset-pwd-cancel"
          >
            Cancel
          </button>
          <button
            onClick={() => void onConfirm()}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            id="reset-pwd-confirm"
          >
            {isSaving ? 'Sending…' : 'Send Reset Link'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Link Success Modal ───────────────────────────────────────────────────────

function LinkSuccessModal({
  name,
  email,
  link,
  isNewUser,
  onClose,
}: {
  name: string;
  email: string;
  link: string;
  isNewUser: boolean;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 text-center animate-in fade-in zoom-in-95 duration-150">
        <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
          <Check className="w-6 h-6 text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-1" style={{ fontFamily: 'Playfair Display, serif' }}>
          {isNewUser ? 'Account Provisioned' : 'Password Reset Link'}
        </h3>
        <p className="text-xs text-gray-400 mb-4">
          {isNewUser
            ? 'The account has been created in both PostgreSQL and Firebase Auth. Send the setup link below to the user.'
            : 'A new password reset link has been generated. Send the link below to the user.'}
        </p>

        {/* User Info card */}
        <div className="bg-gray-50 border border-gray-150 rounded-lg p-3 text-left mb-4">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User Details</div>
          <div className="text-sm font-bold text-gray-800 mt-1">{name}</div>
          <div className="text-xs text-gray-500">{email}</div>
        </div>

        {/* Link container */}
        <div className="text-left mb-6">
          <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
            Setup / Reset Link
          </label>
          <div className="relative">
            <textarea
              readOnly
              value={link}
              className="w-full px-3 py-2 pr-10 border border-gray-200 rounded-lg text-xs font-mono text-gray-600 bg-gray-50 h-20 resize-none focus:outline-none"
            />
            <Tooltip content={copied ? "Copied!" : "Copy setup link"} side="left">
              <button
                onClick={handleCopy}
                className="absolute right-2 top-2 p-1.5 bg-white border border-gray-100 text-gray-500 hover:text-gray-800 rounded-md shadow-sm transition-colors"
                aria-label="Copy setup link to clipboard"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-600" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </Tooltip>

          </div>
          {copied && (
            <div className="text-[10px] text-green-600 font-semibold mt-1">
              Copied to clipboard!
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
            className="flex items-center gap-1.5 px-4 py-2 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Open Link
          </button>
        </div>
      </div>
    </div>,
    document.body
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

// ─── UserManagementPage ───────────────────────────────────────────────────────

type ActiveTab = 'parishioners' | 'staff';

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'editStaff'; user: ManagedUser }
  | { type: 'editParishioner'; user: ManagedUser }
  | { type: 'viewParishioner'; user: ManagedUser }
  | { type: 'disable'; user: ManagedUser }
  | { type: 'enable'; user: ManagedUser }
  | { type: 'resetPwd'; user: ManagedUser }
  | { type: 'linkSuccess'; name: string; email: string; link: string; isNewUser: boolean };

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export function UserManagementPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('parishioners');
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [staffRole, setStaffRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [modal, setModal] = useState<ModalState>({ type: 'none' });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Auto-dismiss toast after 3s
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') =>
    setToast({ message, type });

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let roleFilter: string;
      if (activeTab === 'parishioners') {
        roleFilter = 'PARISHIONER';
      } else {
        roleFilter = staffRole === 'all' ? 'staff' : staffRole;
      }

      const result = await UserManagementService.getUsers({
        search,
        role: roleFilter,
        status,
      });
      setUsers(result);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, search, staffRole, status]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // Tab switch handler: resets search and role filter
  const handleTabSwitch = (tab: ActiveTab) => {
    setActiveTab(tab);
    setSearch('');
    setStaffRole('all');
    setStatus('all');
  };

  // ── Add Staff User ─────────────────────────────────────────────────────────

  const handleAddStaffSave = async (form: StaffFormData) => {
    setIsSaving(true);
    try {
      const result = await UserManagementService.addUser(form as AddUserPayload);
      setModal({ type: 'none' });
      if (result.setupLink) {
        setModal({
          type: 'linkSuccess',
          name: result.user.name,
          email: result.user.email,
          link: result.setupLink,
          isNewUser: true,
        });
      } else {
        showToast('Staff user added successfully.');
      }
      void fetchUsers();
    } catch {
      showToast('Failed to add staff user.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit Staff User ────────────────────────────────────────────────────────

  const handleEditStaffSave = async (form: StaffFormData, userId: string) => {
    setIsSaving(true);
    try {
      await UserManagementService.editUser(userId, {
        name: form.name,
        email: form.email,
        role: form.role as ManagedUserRole,
        parish: form.parish,
      });
      setModal({ type: 'none' });
      showToast('Staff user updated successfully.');
      void fetchUsers();
    } catch {
      showToast('Failed to update staff user.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit Parishioner ───────────────────────────────────────────────────────

  const handleEditParishionerSave = async (form: ParishionerEditFormData, userId: string) => {
    setIsSaving(true);
    try {
      const clean = (val: string) => val.trim().replace(/\s+/g, ' ');
      const finalName = [clean(form.firstName), clean(form.middleName), clean(form.lastName), clean(form.suffix)]
        .filter(Boolean)
        .join(' ');

      await UserManagementService.editUser(userId, {
        name: finalName,
        contactNumber: form.contactNumber,
        address: form.address,
      });
      setModal({ type: 'none' });
      showToast('Parishioner profile updated successfully.');
      void fetchUsers();
    } catch {
      showToast('Failed to update parishioner profile.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Disable User ───────────────────────────────────────────────────────────

  const handleDisableConfirm = async (userId: string) => {
    setIsSaving(true);
    try {
      await UserManagementService.disableUser(userId);
      setModal({ type: 'none' });
      showToast('Account disabled.');
      void fetchUsers();
    } catch {
      showToast('Failed to disable account.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Enable User ────────────────────────────────────────────────────────────

  const handleEnableConfirm = async (userId: string) => {
    setIsSaving(true);
    try {
      await UserManagementService.enableUser(userId);
      setModal({ type: 'none' });
      showToast('Account enabled.');
      void fetchUsers();
    } catch {
      showToast('Failed to enable account.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Reset Password ─────────────────────────────────────────────────────────

  const handleResetConfirm = async (userId: string) => {
    setIsSaving(true);
    try {
      const resetLink = await UserManagementService.resetPassword(userId);
      const user = users.find((u) => u.id === userId);
      setModal({ type: 'none' });
      if (resetLink && user) {
        setModal({
          type: 'linkSuccess',
          name: user.name,
          email: user.email,
          link: resetLink,
          isNewUser: false,
        });
      } else {
        showToast('Password reset link sent.');
      }
    } catch {
      showToast('Failed to send reset link.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Management"
        subtitle="Manage parishioners and diocesan staff accounts."
        actions={
          activeTab === 'staff' ? (
            <button
              id="add-user-btn"
              onClick={() => setModal({ type: 'add' })}
              className="flex items-center gap-2 px-4 py-2.5 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              Add Staff User
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 bg-gray-100/80 p-1 rounded-xl w-fit border border-gray-200/60">
        <button
          id="tab-parishioners"
          onClick={() => handleTabSwitch('parishioners')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all',
            activeTab === 'parishioners'
              ? 'bg-white text-crimson-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          )}
        >
          <Users className="w-4 h-4" />
          Parishioners
        </button>
        <button
          id="tab-staff"
          onClick={() => handleTabSwitch('staff')}
          className={cn(
            'flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-lg transition-all',
            activeTab === 'staff'
              ? 'bg-white text-crimson-700 shadow-sm'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
          )}
        >
          <Shield className="w-4 h-4" />
          Staff
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            placeholder={
              activeTab === 'parishioners'
                ? 'Search parishioners by name, email, or address...'
                : 'Search staff by name, email, or parish...'
            }
            value={search}
            onChange={setSearch}
            className="flex-1"
          />
          <div className="flex gap-3 flex-wrap">
            {/* Role filter (Staff tab only) */}
            {activeTab === 'staff' && (
              <div className="relative">
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value)}
                  className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[175px]"
                  id="filter-staff-role"
                  aria-label="Filter by staff role"
                >
                  {STAFF_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              </div>
            )}

            {/* Status filter */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[140px]"
                id="filter-user-status"
                aria-label="Filter by status"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <LoadingState message={activeTab === 'parishioners' ? 'Loading parishioners...' : 'Loading staff accounts...'} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          {users.length === 0 ? (
            <EmptyState
              title={activeTab === 'parishioners' ? 'No parishioners found' : 'No staff accounts found'}
              description="Try adjusting your search or filter criteria."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  {activeTab === 'parishioners' ? (
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Contact Number</th>
                      <th>Address / Barangay</th>
                      <th>Registration Date</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  ) : (
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Assigned Parish</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  )}
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      {/* Name Column */}
                      <td>
                        <div className="flex items-center gap-2.5">
                          <Avatar initials={user.avatarInitials} bgColor={user.avatarColor} size="sm" />
                          <span className="font-semibold text-gray-900">{user.name}</span>
                        </div>
                      </td>

                      {/* Parishioners specific columns */}
                      {activeTab === 'parishioners' ? (
                        <>
                          <td className="text-gray-600">{user.email}</td>
                          <td className="text-gray-600 font-mono text-xs">
                            {user.contactNumber || '—'}
                          </td>
                          <td className="text-gray-600 max-w-[240px] truncate">
                            {user.address || user.barangay || '—'}
                          </td>
                          <td className="text-gray-600 text-xs whitespace-nowrap">
                            {formatDate(user.registrationDate || user.createdAt)}
                          </td>
                          <td>
                            <UserStatusBadge status={user.status} />
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                id={`view-parishioner-${user.id}`}
                                onClick={() => setModal({ type: 'viewParishioner', user })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                                aria-label={`View profile for ${user.name}`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                View
                              </button>
                              <button
                                id={`edit-parishioner-${user.id}`}
                                onClick={() => setModal({ type: 'editParishioner', user })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                                aria-label={`Edit ${user.name}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              {user.status === 'Disabled' ? (
                                <button
                                  id={`enable-parishioner-${user.id}`}
                                  onClick={() => setModal({ type: 'enable', user })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors"
                                  aria-label={`Enable ${user.name}`}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  Enable
                                </button>
                              ) : (
                                <button
                                  id={`disable-parishioner-${user.id}`}
                                  onClick={() => setModal({ type: 'disable', user })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors"
                                  aria-label={`Disable ${user.name}`}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  Disable
                                </button>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        /* Staff specific columns */
                        <>
                          <td>
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="text-gray-700 max-w-[200px] truncate">{user.parish}</td>
                          <td className="text-gray-600">{user.email}</td>
                          <td>
                            <UserStatusBadge status={user.status} />
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <button
                                id={`edit-staff-${user.id}`}
                                onClick={() => setModal({ type: 'editStaff', user })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                                aria-label={`Edit ${user.name}`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Edit
                              </button>
                              {user.status === 'Disabled' ? (
                                <button
                                  id={`enable-staff-${user.id}`}
                                  onClick={() => setModal({ type: 'enable', user })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors"
                                  aria-label={`Enable ${user.name}`}
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  Enable
                                </button>
                              ) : (
                                <button
                                  id={`disable-staff-${user.id}`}
                                  onClick={() => setModal({ type: 'disable', user })}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 rounded-md hover:bg-amber-100 transition-colors"
                                  aria-label={`Disable ${user.name}`}
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  Disable
                                </button>
                              )}
                              <button
                                id={`reset-pwd-${user.id}`}
                                onClick={() => setModal({ type: 'resetPwd', user })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
                                aria-label={`Reset password for ${user.name}`}
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                                Reset Pwd
                              </button>
                            </div>
                          </td>
                        </>
                      )}
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
        <StaffUserModal
          user={null}
          onSave={handleAddStaffSave}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {modal.type === 'editStaff' && (
        <StaffUserModal
          user={modal.user}
          onSave={(form) => handleEditStaffSave(form, modal.user.id)}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {modal.type === 'editParishioner' && (
        <ParishionerEditModal
          user={modal.user}
          onSave={(form) => handleEditParishionerSave(form, modal.user.id)}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {modal.type === 'viewParishioner' && (
        <ParishionerProfileModal
          user={modal.user}
          onEdit={() => setModal({ type: 'editParishioner', user: modal.user })}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {modal.type === 'disable' && (
        <DisableConfirmModal
          user={modal.user}
          onConfirm={() => handleDisableConfirm(modal.user.id)}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {modal.type === 'enable' && (
        <EnableConfirmModal
          user={modal.user}
          onConfirm={() => handleEnableConfirm(modal.user.id)}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {modal.type === 'resetPwd' && (
        <ResetPasswordModal
          user={modal.user}
          onConfirm={() => handleResetConfirm(modal.user.id)}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {modal.type === 'linkSuccess' && (
        <LinkSuccessModal
          name={modal.name}
          email={modal.email}
          link={modal.link}
          isNewUser={modal.isNewUser}
          onClose={() => setModal({ type: 'none' })}
        />
      )}

      {/* ── Toast ── */}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}
