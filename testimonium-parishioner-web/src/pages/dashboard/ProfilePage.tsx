import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { User, Bell, Shield, LogOut, Info } from 'lucide-react';
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const wasCompletingProfile = isNewUser || Boolean(appProfile?.needsProfileCompletion);
    setSaving(true);
    try {
      await updateProfile({
        displayName,
        phone,
        address,
        notificationsEnabled: emailNotifications
      });
      const refreshedProfile = await refreshProfile();

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
          <div className="lg:col-span-4 text-center">
            <Card>
              <CardContent className="pt-8 space-y-4">
                <div className="flex justify-center">
                  <Skeleton className="w-24 h-24 rounded-full animate-pulse" />
                </div>
                <Skeleton className="h-5 w-1/2 mx-auto rounded animate-pulse" />
                <Skeleton className="h-4 w-3/4 mx-auto rounded animate-pulse" />
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
        {/* Left Side: Avatar Card */}
        <div className="lg:col-span-4 text-center">
          <Card>
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
                <Button variant="ghost" onClick={() => logout()} className="w-full flex items-center justify-center space-x-2 text-status-rejected hover:bg-red-50/50">
                  <LogOut size={16} />
                  <span>Log Out of Profile</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Side: Details forms */}
        <div className="lg:col-span-8 space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center space-x-2">
                  <User size={16} className="text-crimson" />
                  <span>Personal Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  label="Display Name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Full Name"
                />
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
                    type="checkbox"
                    checked={emailNotifications}
                    onChange={e => setEmailNotifications(e.target.checked)}
                    aria-label="Email Notifications"
                    className="w-4 h-4 rounded text-crimson border-border focus-ring cursor-pointer"
                  />
                </div>
              </CardContent>
            </Card>

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
              <Button type="submit" loading={saving} disabled={saving}>Save Settings</Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
