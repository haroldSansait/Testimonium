import { useOtpCooldown } from '../../hooks/useOtpCooldown';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, RefreshCw, Edit3, ShieldAlert, ArrowRight } from 'lucide-react';
import { updateEmail, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { OtpInput } from '../../components/ui/OtpInput';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

type VerificationFsmState = 'IDLE' | 'VERIFYING' | 'SUCCESS' | 'ROUTING';

export const VerifyEmailPage: React.FC = () => {
  const { user, appProfile, loading: authLoading, refreshProfile, logout, requestEmailVerificationOtp, confirmEmailVerificationOtp } = useAuth();
  const navigate = useNavigate();

  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [currentPassword, setCurrentPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [fsmState, setFsmState] = useState<VerificationFsmState>('IDLE');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useOtpCooldown();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Change Email Modal state
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);

  const handleOpenChangeEmail = useCallback(() => {
    setError('');
    setNewEmail('');
    setCurrentPassword('');
    setIsChangeEmailOpen(true);
  }, []);

  const handleCloseChangeEmail = useCallback(() => {
    setIsChangeEmailOpen(false);
    setError('');
  }, []);

  // Submit OTP Verification
  const handleVerifyCode = useCallback(async (codeToVerify?: string) => {
    const code = (codeToVerify || otp).trim();
    if (!/^\d{6}$/.test(code) || fsmState !== 'IDLE' || busyRef.current) return;
    busyRef.current = true;

    setFsmState('VERIFYING');
    setError('');
    setMessage('');

    try {
      await confirmEmailVerificationOtp(code);
      if (!mountedRef.current) return;
      setFsmState('SUCCESS');
      setMessage('Email verified successfully! Preparing your dashboard...');

      navigate('/dashboard/home', { replace: true });
    } catch (err: any) {
      if (!mountedRef.current) return;
      busyRef.current = false;
      setFsmState('IDLE');
      const msg = err?.message || 'Verification failed. Please check the code and try again.';
      setError(msg);
    }
  }, [otp, fsmState, confirmEmailVerificationOtp, navigate]);

  // Handle Resend Verification Code
  const handleResendCode = async () => {
    if (cooldown > 0 || !auth.currentUser || fsmState !== 'IDLE' || busyRef.current) return;
    busyRef.current = true;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await requestEmailVerificationOtp();
      if (!mountedRef.current) return;
      if (response.alreadyVerified) { await auth.currentUser?.reload(); await auth.currentUser?.getIdToken(true); await refreshProfile(); return; }
      const retrySec = response?.retryAfter || 60;
      setCooldown(retrySec);
      setMessage(`A fresh 6-digit code has been sent to ${auth.currentUser?.email}.`);
      setOtp('');
    } catch (err: any) {
      if (!mountedRef.current) return;
      if (err?.retryAfter) {
        setCooldown(err.retryAfter);
      }
      setError(err?.message || 'Failed to send verification code. Please try again.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Handle Changing Mistyped Email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNewEmail = newEmail.trim().toLowerCase();
    if (!cleanNewEmail || !auth.currentUser || busyRef.current) return;
    busyRef.current = true;
    const expectedUser = auth.currentUser;

    setChangeEmailLoading(true);
    setError('');
    setMessage('');

    try {
      // 1. Update authoritative email on Firebase
      if (!expectedUser.email || !currentPassword) throw new Error('Enter your current password to change email.');
      await reauthenticateWithCredential(expectedUser, EmailAuthProvider.credential(expectedUser.email, currentPassword));
      if (!mountedRef.current || auth.currentUser?.uid !== expectedUser.uid) return;
      await updateEmail(expectedUser, cleanNewEmail);
      await expectedUser.reload();
      await expectedUser.getIdToken(true);
      await refreshProfile();

      // 2. Request new OTP for the updated email address
      await requestEmailVerificationOtp();
      if (!mountedRef.current || auth.currentUser?.uid !== expectedUser.uid) return;
      setCurrentPassword('');
      setMessage(`Email updated to ${cleanNewEmail}. A new verification code has been sent!`);
      setIsChangeEmailOpen(false);
      setNewEmail('');
      setOtp('');
      setCooldown(60);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message || 'Failed to update email. You may need to log in again.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setChangeEmailLoading(false);
    }
  };

  const formatCooldownDisplay = (seconds: number) => {
    if (seconds <= 0) return '';
    if (seconds <= 60) return `Resend in ${seconds}s`;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `Resend in ${hours}h ${minutes}m`;
    return `Resend in ${minutes}m ${seconds % 60}s`;
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    if (appProfile?.emailVerified) { navigate('/dashboard/home', { replace: true }); return; }
    if (typeof window !== 'undefined' && user?.uid) {
      const isInitial = sessionStorage.getItem(`otp_initial_sent_${user.uid}`) || sessionStorage.getItem('testimonium_registration_session');
      if (isInitial) {
        setMessage(`A verification code has been sent to ${user.email || auth.currentUser?.email || 'your email'}.`);
      }
    }
  }, [authLoading, user?.uid, user?.email, appProfile?.emailVerified, navigate]);

  const currentEmail = user?.email || auth.currentUser?.email || 'your registered email';
  const isVerifying = fsmState === 'VERIFYING';
  const isSuccess = fsmState === 'SUCCESS' || fsmState === 'ROUTING';

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 bg-app-base">
      {/* Left side - Visual Institutional Branding */}
      <div 
        className="hidden md:flex md:col-span-5 text-white flex-col justify-center items-center text-center p-12 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(123, 28, 42, 0.88), rgba(123, 28, 42, 0.92)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10 space-y-6 max-w-md flex flex-col items-center animate-in fade-in duration-700">
          <div className="p-4 bg-white/10 rounded-2xl backdrop-blur-md">
            <Mail size={56} className="text-white/90" />
          </div>
          <h3 className="text-3xl font-serif font-bold leading-tight">
            Verify Your Email Address
          </h3>
          <p className="text-sm text-white/80 leading-relaxed">
            Security and account integrity are paramount. Please verify ownership of your email address with the six-digit code sent to your inbox.
          </p>
        </div>
      </div>

      {/* Right side - OTP Verification Actions */}
      <div className="col-span-1 md:col-span-7 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          
          <div className="space-y-3 text-center sm:text-left">
            <div className="inline-flex p-3 bg-crimson/10 text-crimson rounded-2xl sm:hidden">
              <Mail size={32} />
            </div>
            <h1 className="text-3xl font-serif font-bold text-text-primary">
              Enter Verification Code
            </h1>
            <p className="text-sm text-text-muted leading-relaxed">
              Request a six-digit code for:
            </p>
            <div className="p-3.5 bg-slate-100 rounded-xl border border-slate-300 text-gray-900 font-mono text-sm font-semibold text-center sm:text-left break-all shadow-sm">
              {currentEmail}
            </div>
          </div>

          {/* Dynamic Notifications */}
          <div aria-live="polite" className="space-y-3">
            {message && (
              <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-xl flex items-start space-x-2.5 text-xs font-semibold shadow-sm animate-in fade-in">
                <CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
                <span>{message}</span>
              </div>
            )}

            {error && (
              <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 rounded-xl flex items-start space-x-2.5 text-xs font-semibold shadow-sm animate-in fade-in">
                <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Six-digit OTP Input */}
          <div className="space-y-3 py-2">
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider text-center sm:text-left">
              Six-Digit Code
            </label>
            <OtpInput
              value={otp}
              onChange={(val) => {
                setOtp(val);
                if (error) setError('');
              }}
              onComplete={(code) => {
                void handleVerifyCode(code);
              }}
              disabled={loading || changeEmailLoading || isVerifying || isSuccess}
              hasError={Boolean(error)}
              autoFocus
              idPrefix="email-verify-otp"
            />
            <p className="text-[11px] text-text-muted text-center sm:text-left">
              Code expires in 10 minutes. Works once.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => handleVerifyCode()}
              loading={isVerifying}
              disabled={loading || changeEmailLoading || otp.length !== 6 || isVerifying || isSuccess}
              className="w-full py-3 text-sm flex items-center justify-center space-x-2 font-semibold"
            >
              <span>{isSuccess ? 'Verified!' : 'Verify Code'}</span>
              <ArrowRight size={18} />
            </Button>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleResendCode}
                disabled={loading || cooldown > 0 || isVerifying || isSuccess}
                className="w-full text-xs flex items-center justify-center space-x-1.5 py-2.5"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>
                  {cooldown > 0 ? formatCooldownDisplay(cooldown) : 'Resend Code'}
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={handleOpenChangeEmail}
                disabled={isVerifying || isSuccess}
                className="w-full text-xs flex items-center justify-center space-x-1.5 py-2.5 text-text-muted hover:text-text-primary"
              >
                <Edit3 size={14} />
                <span>Change Email</span>
              </Button>
            </div>
          </div>

          {/* Secondary Footer Action */}
          <div className="pt-6 border-t border-border flex items-center justify-between text-xs text-text-muted">
            <span>Wrong account?</span>
            <button
              onClick={() => logout('manual')}
              disabled={isVerifying || isSuccess}
              className="font-medium text-crimson hover:underline focus-ring"
            >
              Sign out and return to login
            </button>
          </div>

        </div>
      </div>

      {/* Change Email Modal */}
      <Modal
        isOpen={isChangeEmailOpen}
        onClose={handleCloseChangeEmail}
        title="Update Email Address"
      >
        <form onSubmit={handleChangeEmail} className="space-y-4 px-1 py-1">
          <p className="text-xs text-text-muted leading-relaxed">
            Enter your correct email address. A fresh six-digit verification code will be sent to the updated address immediately.
          </p>

          {error && isChangeEmailOpen && (
            <div className="p-3 bg-red-50 border border-red-300 text-red-900 rounded-lg flex items-start space-x-2 text-xs font-semibold">
              <ShieldAlert size={15} className="mt-0.5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <Input
            id="change-email-input"
            label="New Email Address"
            type="email"
            placeholder="e.g. correct.name@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            autoFocus
            disabled={changeEmailLoading}
          />

          <Input
            id="change-email-password"
            label="Current Password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={e => setCurrentPassword(e.target.value)}
            required
            disabled={changeEmailLoading}
          />
          <div className="flex justify-end space-x-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseChangeEmail}
              disabled={changeEmailLoading}
            >
              Cancel
            </Button>
            <Button type="submit" loading={changeEmailLoading}>
              Update & Send Code
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default VerifyEmailPage;
