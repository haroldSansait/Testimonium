import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, RefreshCw, Edit3, ShieldAlert, ArrowRight } from 'lucide-react';
import { sendEmailVerification, updateEmail } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

type VerificationFsmState = 'IDLE' | 'VERIFYING' | 'FETCHING_PROFILE' | 'ROUTING' | 'COMPLETE';

export const VerifyEmailPage: React.FC = () => {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [fsmState, setFsmState] = useState<VerificationFsmState>('IDLE');
  const fsmStateRef = useRef<VerificationFsmState>('IDLE');

  const updateFsmState = (nextState: VerificationFsmState) => {
    console.debug(`[VerifyEmailPage FSM] State transition: ${fsmStateRef.current} -> ${nextState}`);
    fsmStateRef.current = nextState;
    setFsmState(nextState);
  };

  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  // Change Email Modal state
  const [isChangeEmailOpen, setIsChangeEmailOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changeEmailLoading, setChangeEmailLoading] = useState(false);

  // 60-second cooldown timer tick
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  // FSM-based verification runner
  const handleCheckVerification = useCallback(async (isAutoCheck = false) => {
    if (!auth.currentUser) return;
    
    // Prevent duplicate triggers if FSM is currently processing or complete
    if (fsmStateRef.current !== 'IDLE') return;

    updateFsmState('VERIFYING');

    if (!isAutoCheck) {
      setError('');
      setMessage('');
    }

    try {
      await auth.currentUser.reload();
      const currentUser = auth.currentUser;

      if (currentUser?.emailVerified) {
        setMessage('Email verified successfully! Synchronizing profile...');
        updateFsmState('FETCHING_PROFILE');

        // Force fresh ID Token & refresh context profile
        await currentUser.getIdToken(true);
        await refreshProfile();

        updateFsmState('ROUTING');
        setMessage('Redirecting to your portal...');

        setTimeout(() => {
          updateFsmState('COMPLETE');
          console.debug('[VerifyEmailPage FSM] Navigating to /dashboard/home');
          navigate('/dashboard/home', { replace: true });
        }, 800);
      } else {
        updateFsmState('IDLE');
        if (!isAutoCheck) {
          setError('Your email address has not been verified yet. Please check your inbox and click the verification link.');
        }
      }
    } catch (err: any) {
      updateFsmState('IDLE');
      if (!isAutoCheck) {
        setError(err?.message || 'Failed to check verification status. Please try again.');
      }
    }
  }, [navigate, refreshProfile]);

  // Dual event listeners: visibilitychange & window.focus
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleCheckVerification(true);
      }
    };

    const onWindowFocus = () => {
      handleCheckVerification(true);
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onWindowFocus);

    // Periodic polling as fallback
    const interval = setInterval(() => {
      handleCheckVerification(true);
    }, 5000);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onWindowFocus);
      clearInterval(interval);
    };
  }, [handleCheckVerification]);

  // Handle Resend Verification Email
  const handleResendEmail = async () => {
    if (cooldown > 0 || !auth.currentUser) return;

    setLoading(true);
    setError('');
    setMessage('');

    try {
      // 1. Call Backend to check rate limit & 60s cooldown
      const idToken = await auth.currentUser.getIdToken();
      const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

      const resendRes = await fetch(`${API_URL}/auth/resend-verification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: auth.currentUser.email }),
      });

      const resendData = await resendRes.json();

      if (!resendRes.ok) {
        if (resendData?.retryAfter) {
          setCooldown(resendData.retryAfter);
        } else {
          setCooldown(60);
        }
        throw new Error(resendData?.message || 'Failed to resend verification email.');
      }

      // 2. Trigger Firebase Auth sendEmailVerification
      await sendEmailVerification(auth.currentUser);

      setMessage(`A fresh verification link has been sent to ${auth.currentUser.email}.`);
      setCooldown(60);
    } catch (err: any) {
      setError(err?.message || 'Failed to send verification email.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Changing Mistyped Email
  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !auth.currentUser) return;

    setChangeEmailLoading(true);
    setError('');
    setMessage('');

    try {
      await updateEmail(auth.currentUser, newEmail);
      await sendEmailVerification(auth.currentUser);

      setMessage(`Email updated to ${newEmail}. Verification email sent!`);
      setIsChangeEmailOpen(false);
      setNewEmail('');
      setCooldown(60);
    } catch (err: any) {
      setError(err?.message || 'Failed to update email. You may need to log in again.');
    } finally {
      setChangeEmailLoading(false);
    }
  };

  const currentEmail = user?.email || auth.currentUser?.email || 'your email';
  const isProcessing = fsmState !== 'IDLE';

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 bg-app-base">
      {/* Left side - Visual Branding */}
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
            Security and account integrity are paramount. Please verify ownership of your email address to access your parishioner services.
          </p>
        </div>
      </div>

      {/* Right side - Verification Actions */}
      <div className="col-span-1 md:col-span-7 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          
          <div className="space-y-3 text-center sm:text-left">
            <div className="inline-flex p-3 bg-crimson/10 text-crimson rounded-2xl sm:hidden">
              <Mail size={32} />
            </div>
            <h1 className="text-3xl font-serif font-bold text-text-primary">
              Check Your Inbox
            </h1>
            <p className="text-sm text-text-muted leading-relaxed">
              We have sent a verification link to:
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

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            <Button
              onClick={() => handleCheckVerification(false)}
              loading={isProcessing}
              disabled={isProcessing}
              className="w-full py-3 text-sm flex items-center justify-center space-x-2 font-semibold"
            >
              <span>{isProcessing ? `Status: ${fsmState}...` : "I've Verified"}</span>
              <ArrowRight size={18} />
            </Button>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleResendEmail}
                disabled={loading || cooldown > 0 || isProcessing}
                className="w-full text-xs flex items-center justify-center space-x-1.5 py-2.5"
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                <span>
                  {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Email'}
                </span>
              </Button>

              <Button
                variant="outline"
                onClick={() => setIsChangeEmailOpen(true)}
                disabled={isProcessing}
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
              disabled={isProcessing}
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
        onClose={() => setIsChangeEmailOpen(false)}
        title="Update Email Address"
      >
        <form onSubmit={handleChangeEmail} className="space-y-4">
          <p className="text-xs text-text-muted">
            Enter your correct email address. A new verification link will be sent to this email immediately.
          </p>

          <Input
            label="New Email Address"
            type="email"
            placeholder="e.g. correct.name@email.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            required
            disabled={changeEmailLoading}
          />

          <div className="flex justify-end space-x-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsChangeEmailOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={changeEmailLoading}>
              Update & Resend
            </Button>
          </div>
        </form>
      </Modal>

    </div>
  );
};

export default VerifyEmailPage;

