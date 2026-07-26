import { useState, useEffect } from 'react';
import {
  User,
  Mail,
  Phone,
  Building,
  Shield,
  Save,
  Check,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/config/firebase';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/ui/PageHeader';
import api from '@/api/api';

// ─── Role label helpers ────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SECRETARY: 'Parish Secretary',
  PRIEST: 'Parish Priest',
  DIOCESE_COORDINATOR: 'Diocese Coordinator',
  PARISHIONER: 'Parishioner',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({
  message,
  variant = 'success',
  onClose,
}: {
  message: string;
  variant?: 'success' | 'error';
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-semibold animate-in slide-in-from-bottom-4 ${
        variant === 'success'
          ? 'bg-emerald-700 text-white'
          : 'bg-red-700 text-white'
      }`}
    >
      {variant === 'success' ? (
        <Check className="w-4 h-4 flex-shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 flex-shrink-0" />
      )}
      {message}
    </div>
  );
}

// ─── Read-only field ──────────────────────────────────────────────────────────

function ReadOnlyField({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
        <span className="flex-shrink-0 text-gray-400">{icon}</span>
        <span>{value || '—'}</span>
      </div>
    </div>
  );
}

// ─── Editable field ───────────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  icon,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">
        {label}
      </label>
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-white border border-gray-200 rounded-lg focus-within:border-[#7B1C2A] transition-colors">
        <span className="flex-shrink-0 text-gray-400">{icon}</span>
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="flex-1 text-sm text-gray-800 outline-none bg-transparent placeholder-gray-400"
        />
      </div>
    </div>
  );
}

// ─── Section Card ─────────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gray-50">
        <span className="text-[#7B1C2A]">{icon}</span>
        <h2 className="text-sm font-bold text-gray-800">{title}</h2>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

// ─── ProfilePage ──────────────────────────────────────────────────────────────

interface ProfileData {
  fullName: string;
  contactNumber: string;
  email: string;
  role: string;
  parishName: string;
}

export function ProfilePage() {
  const { applicationUser, currentUser, refreshUser } = useAuth();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [contactNumber, setContactNumber] = useState('');

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; variant: 'success' | 'error' } | null>(null);

  const [resetSending, setResetSending] = useState(false);
  const [resetBanner, setResetBanner] = useState<{ message: string; isError: boolean } | null>(null);

  // ── Fetch full profile from backend ────────────────────────────────────
  useEffect(() => {
    const fetchProfile = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const response = await api.get<{ data: any }>('/auth/profile');
        const d = response.data.data;
        const data: ProfileData = {
          fullName: d.fullName || '',
          contactNumber: d.contactNumber || '',
          email: d.email || '',
          role: d.role || '',
          parishName: d.parish?.parishName || '',
        };
        setProfileData(data);
        setFullName(data.fullName);
        setContactNumber(data.contactNumber);
      } catch (err: any) {
        setLoadError(err?.message || 'Failed to load profile. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    void fetchProfile();
  }, []);

  // ── Save profile ────────────────────────────────────────────────────────
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/auth/profile', {
        fullName: fullName.trim(),
        contactNumber: contactNumber.trim(),
      });
      // Refresh the auth context so navbar/sidebar picks up new name
      await refreshUser();
      setToast({ message: 'Profile updated successfully.', variant: 'success' });
    } catch (err: any) {
      setToast({
        message: err?.response?.data?.message || err?.message || 'Failed to save profile.',
        variant: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  // ── Password reset ──────────────────────────────────────────────────────
  const handlePasswordReset = async () => {
    const email = currentUser?.email || applicationUser?.email;
    if (!email) {
      setResetBanner({ message: 'Error: Email address not found.', isError: true });
      return;
    }
    setResetSending(true);
    setResetBanner(null);
    try {
      await sendPasswordResetEmail(auth, email);
      setResetBanner({
        message: `Password reset email sent to ${email}. Please check your inbox.`,
        isError: false,
      });
    } catch (err: any) {
      setResetBanner({
        message: err?.message || 'Failed to send password reset email.',
        isError: true,
      });
    } finally {
      setResetSending(false);
    }
  };

  // ── Loading state ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div>
        <PageHeader
          title="My Profile"
          subtitle="Manage your personal information and account settings."
        />
        <div className="mt-6 grid gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white border border-gray-200 rounded-xl h-40 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div>
        <PageHeader
          title="My Profile"
          subtitle="Manage your personal information and account settings."
        />
        <div className="mt-6 bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-800">Failed to load profile</p>
            <p className="text-xs text-red-600 mt-0.5">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[profileData?.role || ''] || profileData?.role || '—';

  return (
    <div>
      <PageHeader
        title="My Profile"
        subtitle="Manage your personal information and account settings."
      />

      <form onSubmit={(e) => void handleSave(e)} className="mt-6 grid gap-5">
        {/* ── Identity (read-only) ── */}
        <SectionCard title="Account Identity" icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ReadOnlyField
              label="Email Address"
              value={profileData?.email || ''}
              icon={<Mail className="w-4 h-4" />}
            />
            <ReadOnlyField
              label="Role"
              value={roleLabel}
              icon={<Shield className="w-4 h-4" />}
            />
            {profileData?.parishName && (
              <ReadOnlyField
                label="Assigned Parish"
                value={profileData.parishName}
                icon={<Building className="w-4 h-4" />}
              />
            )}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">
            Email, role, and parish assignment are managed by your Diocese Coordinator. Contact them
            if these details need to be changed.
          </p>
        </SectionCard>

        {/* ── Personal Information (editable) ── */}
        <SectionCard title="Personal Information" icon={<User className="w-4 h-4" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <EditableField
              label="Display Name"
              value={fullName}
              onChange={setFullName}
              placeholder="Full name"
              icon={<User className="w-4 h-4" />}
            />
            <EditableField
              label="Contact Number"
              value={contactNumber}
              onChange={setContactNumber}
              placeholder="+63 9XX XXX XXXX"
              icon={<Phone className="w-4 h-4" />}
            />
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#7B1C2A] hover:bg-[#9B2C3A] text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors shadow-sm"
            >
              {saving ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </SectionCard>

        {/* ── Security ── */}
        <SectionCard title="Security & Password" icon={<KeyRound className="w-4 h-4" />}>
          <p className="text-xs text-gray-500 leading-relaxed">
            Passwords are managed through Firebase authentication. Click below to receive a secure
            password reset link at your registered email address.
          </p>

          {resetBanner && (
            <div
              className={`flex items-start gap-2.5 px-4 py-3 rounded-lg text-xs font-medium border ${
                resetBanner.isError
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
            >
              {resetBanner.isError ? (
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              ) : (
                <Check className="w-4 h-4 flex-shrink-0 mt-0.5" />
              )}
              {resetBanner.message}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={resetSending}
              onClick={() => void handlePasswordReset()}
              className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-lg disabled:opacity-50 transition-colors"
            >
              {resetSending ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="w-3.5 h-3.5" />
                  Send Password Reset Email
                </>
              )}
            </button>
          </div>
        </SectionCard>
      </form>

      {/* Toast */}
      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
