import { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronDown, Pencil, UserX, KeyRound, X, Check, UserPlus, Copy, ExternalLink } from 'lucide-react';
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
  PRIEST: 'Priest',
};

const roleStyles: Record<ManagedUserRole, string> = {
  DIOCESE_COORDINATOR: 'bg-red-50 text-crimson-700',
  SECRETARY: 'bg-blue-50 text-blue-700',
  PRIEST: 'bg-purple-50 text-purple-700',
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

const ROLE_OPTIONS = [
  { label: 'All Roles', value: 'all' },
  { label: 'Diocese Coordinator', value: 'DIOCESE_COORDINATOR' },
  { label: 'Secretary', value: 'SECRETARY' },
  { label: 'Priest', value: 'PRIEST' },
];

const STATUS_OPTIONS = [
  { label: 'All Statuses', value: 'all' },
  { label: 'Active', value: 'Active' },
  { label: 'Inactive', value: 'Inactive' },
  { label: 'Disabled', value: 'Disabled' },
];

// ─── Add / Edit User Modal ────────────────────────────────────────────────────

interface UserFormData {
  name: string;
  email: string;
  role: ManagedUserRole | '';
  parish: string;
}

const EMPTY_FORM: UserFormData = { name: '', email: '', role: '', parish: '' };

interface UserModalProps {
  /** null = Add mode, ManagedUser = Edit mode */
  user: ManagedUser | null;
  onSave: (data: UserFormData) => Promise<void>;
  onClose: () => void;
  isSaving: boolean;
}

function UserModal({ user, onSave, onClose, isSaving }: UserModalProps) {
  const isEdit = user !== null;
  const [form, setForm] = useState<UserFormData>(
    isEdit
      ? { name: user.name, email: user.email, role: user.role, parish: user.parish }
      : { ...EMPTY_FORM }
  );

  const [parishes, setParishes] = useState<string[]>([]);

  useEffect(() => {
    ParishManagementService.getParishes()
      .then((list) => setParishes(list.map((p) => p.name)))
      .catch((err) => console.error('Failed to load parishes:', err));
  }, []);

  const set =
    (field: keyof UserFormData) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const canSubmit = Boolean(form.name && form.email && form.role && form.parish);

  return (
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
                {isEdit ? 'Edit User' : 'Add User'}
              </h2>
              <p className="text-xs text-gray-400">
                {isEdit ? `Editing ${user.name}` : 'Create a new admin account'}
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

          <FormField label="Role" id="um-role" required>
            <select
              id="um-role"
              className={inputCls}
              value={form.role}
              onChange={set('role')}
            >
              <option value="">Select role...</option>
              <option value="DIOCESE_COORDINATOR">Diocese Coordinator</option>
              <option value="SECRETARY">Secretary</option>
              <option value="PRIEST">Priest</option>
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
            {isSaving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add User'}
          </button>
        </div>
      </div>
    </div>
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
  return (
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
          <span className="font-medium text-gray-800">{user.name}</span> will lose access to the
          admin portal. You can re-enable them later by editing their account.
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
    </div>
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
  return (
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
          <span className="font-medium text-gray-800">{user.name}</span> will regain access to the
          admin portal.
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
    </div>
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
  return (
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
    </div>
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

  return (
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
            <button
              onClick={handleCopy}
              className="absolute right-2 top-2 p-1.5 bg-white border border-gray-100 text-gray-500 hover:text-gray-800 rounded-md shadow-sm transition-colors"
              title="Copy to clipboard"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-600" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
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

// ─── UserManagementPage ───────────────────────────────────────────────────────

type ModalState =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; user: ManagedUser }
  | { type: 'disable'; user: ManagedUser }
  | { type: 'enable'; user: ManagedUser }
  | { type: 'resetPwd'; user: ManagedUser }
  | { type: 'linkSuccess'; name: string; email: string; link: string; isNewUser: boolean };

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

export function UserManagementPage() {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
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

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await UserManagementService.getUsers({ search, role, status });
      setUsers(result);
    } catch (err: any) {
      console.error('Failed to load users:', err);
      setError(err?.message || 'Failed to connect to the backend server. Please verify your connection.');
    } finally {
      setIsLoading(false);
    }
  }, [search, role, status]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  // ── Add User ───────────────────────────────────────────────────────────────

  const handleAddSave = async (form: UserFormData) => {
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
        showToast('User added successfully.');
      }
      void fetchUsers();
    } catch {
      showToast('Failed to add user.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Edit User ──────────────────────────────────────────────────────────────

  const handleEditSave = async (form: UserFormData, userId: string) => {
    setIsSaving(true);
    try {
      await UserManagementService.editUser(userId, {
        name: form.name,
        email: form.email,
        role: form.role as ManagedUserRole,
        parish: form.parish,
      });
      setModal({ type: 'none' });
      showToast('User updated successfully.');
      void fetchUsers();
    } catch {
      showToast('Failed to update user.', 'error');
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
    <div>
      <PageHeader
        title="User Management"
        subtitle="Manage Diocese admin accounts — priests, secretaries, and coordinators."
        actions={
          <button
            id="add-user-btn"
            onClick={() => setModal({ type: 'add' })}
            className="flex items-center gap-2 px-4 py-2.5 bg-crimson-700 text-white text-sm font-semibold rounded-lg hover:bg-crimson-800 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add User
          </button>
        }
      />

      {/* Filter Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchBar
            placeholder="Search by name, email, or parish..."
            value={search}
            onChange={setSearch}
            className="flex-1"
          />
          <div className="flex gap-3">
            {/* Role filter */}
            <div className="relative">
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="pl-3 pr-8 py-2.5 border border-gray-200 rounded-md text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 bg-white appearance-none cursor-pointer min-w-[175px]"
                id="filter-user-role"
                aria-label="Filter by role"
              >
                {ROLE_OPTIONS.map((opt) => (
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
                id="filter-user-status"
                aria-label="Filter by status"
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
        <LoadingState message="Loading users..." />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchUsers} />
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          {users.length === 0 ? (
            <EmptyState title="No users found" description="Try adjusting your search or filter criteria." />
          ) : (
            <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Assigned Parish</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={user.avatarInitials} bgColor={user.avatarColor} size="sm" />
                        <span className="font-semibold text-gray-900">{user.name}</span>
                      </div>
                    </td>
                    <td className="text-gray-600">{user.email}</td>
                    <td><RoleBadge role={user.role} /></td>
                    <td className="text-gray-700 max-w-[200px] truncate">{user.parish}</td>
                    <td><UserStatusBadge status={user.status} /></td>
                    <td>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          id={`edit-user-${user.id}`}
                          onClick={() => setModal({ type: 'edit', user })}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                          aria-label={`Edit ${user.name}`}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </button>

                         {user.status === 'Disabled' ? (
                           <button
                             id={`enable-user-${user.id}`}
                             onClick={() => setModal({ type: 'enable', user })}
                             className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 rounded-md hover:bg-emerald-100 transition-colors"
                             aria-label={`Enable ${user.name}`}
                           >
                             <UserPlus className="w-3.5 h-3.5" />
                             Enable
                           </button>
                         ) : (
                           <button
                             id={`disable-user-${user.id}`}
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
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {/* ── Modals ── */}

      {(modal.type === 'add') && (
        <UserModal
          user={null}
          onSave={handleAddSave}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
        />
      )}

      {modal.type === 'edit' && (
        <UserModal
          user={modal.user}
          onSave={(form) => handleEditSave(form, modal.user.id)}
          onClose={() => setModal({ type: 'none' })}
          isSaving={isSaving}
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
