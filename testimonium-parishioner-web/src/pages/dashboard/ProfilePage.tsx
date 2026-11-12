import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Bell, Shield, LogOut, Info, CheckCircle2, Lock, AlertCircle } from 'lucide-react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useProfile } from '../../hooks/useService';
import { PageHeader } from '../../components/ui/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Avatar } from '../../components/ui/Avatar';
import { Skeleton } from '../../components/ui/Skeleton';
import { ErrorState } from '../../components/ui/ErrorState';
import { GovernmentIdSection } from '../../components/profile/GovernmentIdSection';
import { doesConfirmedNameMatchDisplayed } from '../../utils/nameHelpers';

export const ProfilePage: React.FC = () => {
  const { user, appProfile, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const location = useLocation();
  const isNewUser = (location.state as any)?.isNewUser || false;
  
  const profileQuery = useProfile(user?.uid || '');
  const { data: profile, loading, error, refetch, updateProfile } = profileQuery;

  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Google legal-name confirmation state (new Google parishioners only)
  const [confirmationChoice, setConfirmationChoice] = useState<'confirm' | 'correct' | null>(null);
  const [confirmFirstName, setConfirmFirstName] = useState('');
  const [confirmMiddleName, setConfirmMiddleName] = useState('');
  const [confirmLastName, setConfirmLastName] = useState('');
  const [confirmSuffix, setConfirmSuffix] = useState('');
  const [confirmationError, setConfirmationError] = useState<string | null>(null);
  const [confirmingLegalName, setConfirmingLegalName] = useState(false);
  const [justConfirmedLegalName, setJustConfirmedLegalName] = useState(false);

  const isGovIdVerified = Boolean(
    appProfile?.isGovernmentIdVerified ?? profile?.isGovernmentIdVerified
  );
  const isLegalNameLocked =
    (appProfile?.governmentIdVerificationStatus ?? profile?.governmentIdVerificationStatus) === 'VERIFIED';
  const needsLegalNameConfirmation = Boolean(
    (appProfile?.needsLegalNameConfirmation ?? profile?.needsLegalNameConfirmation) &&
      !isLegalNameLocked
  );
  const displayedGoogleName = (appProfile?.fullName || profile?.displayName || '').trim();
  const storedFirstName = appProfile?.firstName ?? profile?.firstName ?? '';
  const storedMiddleName = appProfile?.middleName ?? profile?.middleName ?? '';
  const storedLastName = appProfile?.lastName ?? profile?.lastName ?? '';
  const storedSuffix = appProfile?.suffix ?? profile?.suffix ?? '';
  const hasStructuredName = Boolean(storedFirstName?.trim() && storedLastName?.trim());

  const handlePasswordReset = async () => {
    if (!user?.email) {
      setResetMessage('Error: Email address not found.');
      return;
    }
    setResetSending(true);
    setResetMessage(null);
    try {
      await sendPasswordResetEmail(auth, user.email);
      setResetMessage('Verification email dispatched! Please check your inbox.');
      toast.success('Verification email dispatched! Please check your inbox.');
    } catch (err: any) {
      setResetMessage(err.message || 'Failed to dispatch verification email.');
      toast.error(err.message || 'Failed to dispatch verification email.');
    } finally {
      setResetSending(false);
    }
  };

  // Sync profile data to local state
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.displayName || '');
      setPhone(profile.phone || '');
      setAddress(profile.address || '');
      setEmailNotifications(profile.notificationsEnabled);
    }
  }, [profile]);

  const handleConfirmLegalName = async () => {
    if (saving || confirmingLegalName || !confirmationChoice) return;

    const cleanFirst = confirmFirstName.trim().replace(/\s+/g, ' ');
    const cleanMiddle = confirmMiddleName.trim().replace(/\s+/g, ' ');
    const cleanLast = confirmLastName.trim().replace(/\s+/g, ' ');
    const cleanSuffix = confirmSuffix.trim().replace(/\s+/g, ' ');

    if (!cleanFirst || !cleanLast) {
      setConfirmationError('First Name and Last Name are required.');
      return;
    }

    if (
      confirmationChoice === 'confirm' &&
      !doesConfirmedNameMatchDisplayed(displayedGoogleName, {
        firstName: cleanFirst,
        middleName: cleanMiddle,
        lastName: cleanLast,
        suffix: cleanSuffix,
      })
    ) {
      setConfirmationError(
        'The entered name components do not match your displayed full name. Please verify your entries or choose "No, I need to correct my name".'
      );
      return;
    }

    setConfirmationError(null);
    setConfirmingLegalName(true);
    try {
      await updateProfile({
        firstName: cleanFirst,
        middleName: cleanMiddle || '',
        lastName: cleanLast,
        suffix: cleanSuffix || '',
        legalNameConfirmationAction: confirmationChoice,
      });
      const refreshedProfile = await refreshProfile(true);
      if (!refreshedProfile) {
        throw new Error('Failed to synchronize updated profile state with the server.');
      }
      if (refreshedProfile.needsLegalNameConfirmation) {
        throw new Error('Your legal name has not been confirmed. Please try again.');
      }
      setDisplayName(refreshedProfile.fullName);
      setJustConfirmedLegalName(true);
      setConfirmationChoice(null);
      setConfirmFirstName('');
      setConfirmMiddleName('');
      setConfirmLastName('');
      setConfirmSuffix('');
      toast.success('Your legal name has been saved successfully.');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save your legal name. Please try again.';
      setConfirmationError(msg);
      toast.error(msg);
    } finally {
      setConfirmingLegalName(false);
    }
  };

  const handleOpenGovIdVerification = () => {
    const el = document.getElementById('government-id-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving || confirmingLegalName) return;

    const wasCompletingProfile = isNewUser || Boolean(appProfile?.needsProfileCompletion);
    setSaving(true);
    try {
      const payload =
        isLegalNameLocked || needsLegalNameConfirmation
          ? {
              phone,
              address,
              notificationsEnabled: emailNotifications,
            }
          : {
              ...(displayName !== profile?.displayName ? { displayName } : {}),
              phone,
              address,
              notificationsEnabled: emailNotifications,
            };

      await updateProfile(payload);
      const refreshedProfile = await refreshProfile(true);

      if (!refreshedProfile) {
        throw new Error('Failed to synchronize updated profile state with the server.');
      }

      if (wasCompletingProfile) {
        if (!refreshedProfile.needsProfileCompletion) {
          toast.success('Profile updated successfully.');
          navigate('/dashboard/home', { replace: true });
        } else {
          toast.info('Profile saved, but some required information is still incomplete.');
        }
      } else {
        toast.success('Profile updated successfully.');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader 
          title="Profile Settings" 
          description="Manage your personal information, security details, and notifications preferences."
          onRefresh={refetch}
          breadcrumbs={['Home', 'Profile']}
        />
        <ErrorState 
          title="Failed to load profile" 
          description="We had trouble retrieving your profile settings. Please try again."
          onRetry={refetch} 
        />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6" aria-busy="true">
        <PageHeader 
          title="Profile Settings" 
          description="Manage your personal information, security details, and notifications preferences."
          onRefresh={refetch}
          isRefreshing={true}
          breadcrumbs={['Home', 'Profile']}
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Avatar Skeleton */}
          <div className="lg:col-span-4 space-y-6">
            <Card className="text-center">
              <CardContent className="pt-8 space-y-4">
                <div className="flex justify-center">
                  <Skeleton className="w-24 h-24 rounded-full animate-pulse" />
                </div>
                <Skeleton className="h-5 w-1/2 mx-auto rounded animate-pulse" />
                <Skeleton className="h-4 w-3/4 mx-auto rounded animate-pulse" />
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-5 w-2/3 rounded animate-pulse" />
                <Skeleton className="h-4 w-full rounded animate-pulse" />
              </CardContent>
            </Card>
          </div>
          {/* Form Skeleton */}
          <div className="lg:col-span-8 space-y-6">
            <Card>
              <CardContent className="pt-6 space-y-4">
                <Skeleton className="h-10 w-full rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded animate-pulse" />
                <Skeleton className="h-10 w-full rounded animate-pulse" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" aria-live="polite">
      <PageHeader 
        title="Profile Settings" 
        description="Manage your personal information, security details, and notifications preferences."
        onRefresh={refetch}
        breadcrumbs={['Home', 'Profile']}
      />

      {/* First-Time User / Incomplete Profile Onboarding Prompt Banner */}
      {Boolean(isNewUser || !profile?.phone || !profile?.address) && (
        <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-card shadow-sm flex items-start space-x-3 text-xs text-amber-800 animate-in fade-in duration-300">
          <Info size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h2 className="font-bold text-amber-900 text-xs sm:text-sm">
              {isNewUser ? 'Welcome to TESTIMONIUM! Let’s complete your profile.' : 'Complete Your Profile Information'}
            </h2>
            <p>
              Finalize your phone number and mailing address below so parish secretaries can contact you regarding sacramental certificates and appointments.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Avatar Card & Notification Preferences */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="text-center">
            <CardContent className="pt-8 space-y-4">
              <div className="flex justify-center">
                <Avatar name={displayName || profile?.email || 'User'} size="lg" className="w-24 h-24" />
              </div>
              <div>
                <h2 className="text-lg font-serif font-bold text-text-primary">
                  {displayName || 'Parishioner'}
                </h2>
                <p className="text-xs text-text-muted mt-0.5">{profile?.email}</p>
              </div>
              <div className="pt-2">
                <Button variant="ghost" type="button" onClick={() => logout()} className="w-full flex items-center justify-center space-x-2 text-status-rejected hover:bg-red-50/50">
                  <LogOut size={16} />
                  <span>Log Out of Profile</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Notification Preferences */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center space-x-2">
                <Bell size={16} className="text-crimson" />
                <span>Notification Preferences</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label htmlFor="email-notifications-checkbox" className="text-xs font-semibold text-text-primary cursor-pointer">
                    Email Notifications
                  </label>
                  <p className="text-[10px] text-text-muted">Receive status logs and confirmation reports on your email.</p>
                </div>
                <input
                  id="email-notifications-checkbox"
                  form="profile-form"
                  type="checkbox"
                  checked={emailNotifications}
                  onChange={e => setEmailNotifications(e.target.checked)}
                  aria-label="Email Notifications"
                  className="w-4 h-4 rounded text-crimson border-border focus-ring cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Details forms */}
        <div className="lg:col-span-8 space-y-6">
          {needsLegalNameConfirmation && (
            <Card className="border-amber-300 bg-amber-50/40 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2 text-amber-950">
                  <Info size={18} className="text-amber-600" />
                  <span>Confirm Your Legal Name</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <div className="p-3 bg-white border border-amber-200 rounded-button space-y-1">
                  <p className="text-[11px] uppercase tracking-wide font-semibold text-text-muted">
                    Current Google Profile Name
                  </p>
                  <p className="text-sm font-serif font-bold text-text-primary">
                    {displayedGoogleName || 'No name provided by Google'}
                  </p>
                </div>

                <p className="text-sm font-semibold text-text-primary">
                  Is this your actual full legal name as shown on your Government ID?
                </p>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={confirmationChoice === 'confirm' ? 'primary' : 'outline'}
                    onClick={() => {
                      setConfirmationChoice('confirm');
                      setConfirmationError(null);
                    }}
                    disabled={saving || confirmingLegalName}
                  >
                    Yes, this is my legal name
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={confirmationChoice === 'correct' ? 'primary' : 'outline'}
                    onClick={() => {
                      setConfirmationChoice('correct');
                      setConfirmationError(null);
                    }}
                    disabled={saving || confirmingLegalName}
                  >
                    No, I need to correct my name
                  </Button>
                </div>

                {confirmationChoice && (
                  <div className="space-y-4 pt-2 border-t border-amber-200/80">
                    <p className="text-text-muted">
                      {confirmationChoice === 'confirm'
                        ? 'Enter your exact First, Middle (if any), Last Name, and Suffix (if any) matching the displayed full legal name above.'
                        : 'Enter your actual legal name exactly as it appears on your Government ID.'}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="First Name *"
                        type="text"
                        placeholder="Juan"
                        value={confirmFirstName}
                        onChange={(e) => {
                          setConfirmFirstName(e.target.value);
                          setConfirmationError(null);
                        }}
                        disabled={saving || confirmingLegalName}
                      />
                      <Input
                        label="Middle Name"
                        type="text"
                        placeholder="Santos (Optional)"
                        value={confirmMiddleName}
                        onChange={(e) => {
                          setConfirmMiddleName(e.target.value);
                          setConfirmationError(null);
                        }}
                        disabled={saving || confirmingLegalName}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="sm:col-span-2">
                        <Input
                          label="Last Name *"
                          type="text"
                          placeholder="Dela Cruz"
                          value={confirmLastName}
                          onChange={(e) => {
                            setConfirmLastName(e.target.value);
                            setConfirmationError(null);
                          }}
                          disabled={saving || confirmingLegalName}
                        />
                      </div>
                      <Input
                        label="Suffix"
                        type="text"
                        placeholder="Jr. (Opt.)"
                        value={confirmSuffix}
                        onChange={(e) => {
                          setConfirmSuffix(e.target.value);
                          setConfirmationError(null);
                        }}
                        disabled={saving || confirmingLegalName}
                      />
                    </div>

                    {confirmationError && (
                      <div
                        role="alert"
                        className="p-3 bg-red-50 border border-red-200 rounded-button text-red-700 text-xs flex items-start gap-2"
                      >
                        <AlertCircle size={16} className="shrink-0 mt-0.5" />
                        <span>{confirmationError}</span>
                      </div>
                    )}

                    <div className="flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        loading={confirmingLegalName}
                        disabled={saving || confirmingLegalName}
                        onClick={() => void handleConfirmLegalName()}
                      >
                        {confirmationChoice === 'confirm'
                          ? 'Confirm Legal Name'
                          : 'Save Corrected Legal Name'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {justConfirmedLegalName && !isGovIdVerified && (
            <Card className="border-emerald-300 bg-emerald-50/70 shadow-sm">
              <CardContent className="pt-5 pb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 size={20} className="text-emerald-700 shrink-0 mt-0.5" />
                  <p className="text-xs sm:text-sm font-medium text-emerald-950 leading-relaxed">
                    Your legal name has been saved successfully. Please verify your Government ID to confirm your identity and access document requests.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="shrink-0"
                  onClick={handleOpenGovIdVerification}
                >
                  Verify Government ID Now
                </Button>
              </CardContent>
            </Card>
          )}

          <form onSubmit={handleSave} id="profile-form" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <User size={16} className="text-crimson" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Input
                    label="Full Name"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Full Name"
                    disabled={isLegalNameLocked || needsLegalNameConfirmation}
                    readOnly={isLegalNameLocked || needsLegalNameConfirmation}
                  />
                  {isLegalNameLocked && (
                    <p className="text-[11px] text-text-muted flex items-center gap-1.5">
                      <Lock size={12} className="text-emerald-700 shrink-0" />
                      <span>Legal name is locked after Government ID verification.</span>
                    </p>
                  )}
                  {!isLegalNameLocked && needsLegalNameConfirmation && (
                    <p className="text-[11px] text-amber-800">
                      Confirm or correct your legal name above before verifying your Government ID.
                    </p>
                  )}
                </div>

                {isLegalNameLocked && hasStructuredName && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                    <Input
                      label="First Name"
                      value={storedFirstName}
                      disabled
                      readOnly
                    />
                    <Input
                      label="Middle Name"
                      value={storedMiddleName || ''}
                      placeholder="None"
                      disabled
                      readOnly
                    />
                    <Input
                      label="Last Name"
                      value={storedLastName}
                      disabled
                      readOnly
                    />
                    <Input
                      label="Suffix"
                      value={storedSuffix || ''}
                      placeholder="None"
                      disabled
                      readOnly
                    />
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Email Address"
                    value={profile?.email || ''}
                    type="email"
                    disabled
                    placeholder="name@email.com"
                  />
                  <Input
                    label="Phone Number"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+63 9XX XXX XXXX"
                  />
                </div>
                <Input
                  label="Mailing Address"
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Address"
                />
              </CardContent>
            </Card>

            {/* Government ID Verification Section */}
            <GovernmentIdSection />

            {/* Security Preferences */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <Shield size={16} className="text-crimson" />
                  <span>Security settings</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-xs">
                <p className="text-text-muted">
                  Passwords are managed through secure Firebase parameters. Click below to request a security verification email.
                </p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  type="button" 
                  loading={resetSending} 
                  onClick={() => void handlePasswordReset()}
                >
                  Send Password Reset Email
                </Button>
                {resetMessage && (
                  <p className={`mt-2 font-medium ${resetMessage.startsWith('Error') ? 'text-status-rejected' : 'text-green-600'}`}>
                    {resetMessage}
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Save Status Bar */}
            <div className="flex items-center justify-end">
              <Button type="submit" loading={saving} disabled={saving || confirmingLegalName}>Save Settings</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
