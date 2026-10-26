import { useOtpCooldown } from '../../hooks/useOtpCooldown';
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, ShieldAlert, CheckCircle, ArrowRight, Eye, EyeOff, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { OtpInput } from '../../components/ui/OtpInput';
import { evaluatePasswordStrength } from '../../utils/passwordStrength';
import { useAuth } from '../../contexts/AuthContext';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

type ForgotPasswordStep = 'EMAIL' | 'OTP' | 'NEW_PASSWORD' | 'SUCCESS';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const busyRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; }; }, []);
  const [step, setStep] = useState<ForgotPasswordStep>('EMAIL');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useOtpCooldown();
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const passwordStrength = evaluatePasswordStrength(newPassword);

  const API_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1';

  // Step 1: Request Password Reset OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail }),
      });

      const data = await response.json().catch(() => null);
      if (!mountedRef.current) return;

      if (!response.ok) {
        if (data?.retryAfter) setCooldown(data.retryAfter);
        throw new Error(data?.message || 'Failed to send password reset code.');
      }

      setCooldown(60);
      setStep('OTP');
      setMessage(`If an eligible account exists, a reset code was requested for ${cleanEmail}.`);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message || 'Failed to process request. Please try again.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (codeToVerify?: string) => {
    const code = (codeToVerify || otp).trim();
    if (code.length !== 6 || loading) return;

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/password-reset/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error(data?.message || 'Invalid or expired verification code.');
      }

      if (!data?.resetToken) {
        throw new Error('Malformed verification response: reset token missing.');
      }

      setResetToken(data.resetToken);
      setStep('NEW_PASSWORD');
      setMessage('Code verified. Please set your new password.');
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message || 'Failed to verify code.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Step 2 Resend: Resend OTP
  const handleResendOtp = async () => {
    if (cooldown > 0 || loading) return;

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/password-reset/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json().catch(() => null);
      if (!mountedRef.current) return;

      if (!response.ok) {
        if (data?.retryAfter) setCooldown(data.retryAfter);
        throw new Error(data?.message || 'Failed to resend reset code.');
      }

      setCooldown(60);
      setOtp('');
      setMessage(`If an eligible account exists, a fresh code was requested for ${email.trim()}.`);
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message || 'Failed to resend code.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  // Step 3: Complete Password Reset
  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      setError('Please fill in both password fields.');
      return;
    }

    if (newPassword.length < 8 || newPassword.length > 128) {
      setError('Password must be between 8 and 128 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (busyRef.current) return;
    busyRef.current = true;
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await fetch(`${API_URL}/auth/password-reset/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          resetToken,
          newPassword,
        }),
      });

      const data = await response.json().catch(() => null);
      if (!mountedRef.current) return;

      if (!response.ok) {
        throw new Error(data?.message || 'Failed to reset password.');
      }

      setResetToken(''); setNewPassword(''); setConfirmPassword('');
      if (user?.email?.trim().toLowerCase() === email.trim().toLowerCase()) { await logout('manual'); return; }
      setStep('SUCCESS');
      setMessage('Your password has been successfully reset.');
    } catch (err: any) {
      if (!mountedRef.current) return;
      setError(err?.message || 'Failed to complete password reset.');
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 bg-app-base">
      {/* Left side - Institutional Branding */}
      <div
        className="hidden md:flex md:col-span-5 text-white flex-col justify-between p-10 lg:p-12 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(107, 15, 26, 0.90), rgba(74, 10, 18, 0.95)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="relative z-10">
          <span className="font-serif font-black text-2xl tracking-wider block">
            TESTIMONIUM
          </span>
          <span className="text-xs text-white/70 tracking-wide font-sans">
            Account Recovery Portal
          </span>
        </div>

        <div className="relative z-10 space-y-6 my-auto max-w-sm">
          <div className="p-3.5 bg-white/10 rounded-2xl backdrop-blur-md inline-block">
            <KeyRound size={40} className="text-white/90" />
          </div>
          <h2 className="text-2xl lg:text-3xl font-serif font-bold leading-snug">
            Secure Password Recovery
          </h2>
          <p className="text-xs lg:text-sm text-white/80 leading-relaxed font-normal">
            Reset your credentials safely using our six-digit verification system to regain access to your parishioner records and canonical appointments.
          </p>
        </div>

        <div className="relative z-10 text-[11px] text-white/50 pt-6">
          Roman Catholic Diocese of San Carlos &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* Right side - Multi-Step Recovery Form */}
      <div className="col-span-1 md:col-span-7 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          
          {/* Header */}
          <div className="space-y-1.5 text-left">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-text-primary">
              {step === 'EMAIL' && 'Forgot Password'}
              {step === 'OTP' && 'Enter Verification Code'}
              {step === 'NEW_PASSWORD' && 'Create New Password'}
              {step === 'SUCCESS' && 'Password Reset Complete'}
            </h1>
            <p className="text-xs sm:text-sm text-text-muted">
              {step === 'EMAIL' && 'Enter your registered email address to receive a six-digit recovery code.'}
              {step === 'OTP' && `If your account is eligible, check ${email} for a code.`}
              {step === 'NEW_PASSWORD' && 'Enter and confirm your new secure account password.'}
              {step === 'SUCCESS' && 'Your account password has been updated. You can now log in.'}
            </p>
          </div>

          {/* Feedback messages */}
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

          {/* STEP 1: Enter Email */}
          {step === 'EMAIL' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <Input
                label="Registered Email Address"
                type="email"
                placeholder="e.g. maria.santos@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                required
                disabled={loading}
                autoFocus
              />

              <Button
                type="submit"
                loading={loading}
                disabled={loading || !email.trim()}
                className="w-full py-3 text-sm font-semibold flex items-center justify-center space-x-2"
              >
                <span>Send Verification Code</span>
                <ArrowRight size={18} />
              </Button>

              <div className="pt-4 text-center">
                <Link
                  to="/login"
                  className="text-xs font-semibold text-crimson hover:underline focus-ring rounded px-1"
                >
                  Return to Sign In
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Verify OTP */}
          {step === 'OTP' && (
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wider text-center">
                  Six-Digit Recovery Code
                </label>
                <OtpInput
                  value={otp}
                  onChange={(val) => {
                    setOtp(val);
                    if (error) setError('');
                  }}
                  onComplete={(code) => {
                    void handleVerifyOtp(code);
                  }}
                  disabled={loading}
                  hasError={Boolean(error)}
                  autoFocus
                  idPrefix="pw-reset-otp"
                />
                <p className="text-[11px] text-text-muted text-center">
                  Code expires in 10 minutes.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  onClick={() => handleVerifyOtp()}
                  loading={loading}
                  disabled={otp.length !== 6 || loading}
                  className="w-full py-3 text-sm font-semibold flex items-center justify-center space-x-2"
                >
                  <span>Verify Code</span>
                  <ArrowRight size={18} />
                </Button>

                <div className="flex items-center justify-between text-xs pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (busyRef.current) return;
                      setResetToken(''); setNewPassword(''); setConfirmPassword('');
                      setStep('EMAIL');
                      setOtp('');
                      setError('');
                    }}
                    className="text-text-muted hover:text-text-primary hover:underline"
                  >
                    Change email
                  </button>

                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={loading || cooldown > 0}
                    className="text-crimson font-semibold hover:underline flex items-center space-x-1 disabled:opacity-50"
                  >
                    <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
                    <span>{cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'NEW_PASSWORD' && <Button variant="outline" disabled={loading} onClick={() => {
            setResetToken(''); setNewPassword(''); setConfirmPassword(''); setOtp(''); setError(''); setStep('EMAIL');
          }}>Request a fresh code</Button>}
          {/* STEP 3: Set New Password */}
          {step === 'NEW_PASSWORD' && (
            <form onSubmit={handleCompleteReset} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="reset-new-password" className="block text-xs font-bold text-text-primary">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-new-password" autoComplete="new-password" maxLength={128}
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => {
                      setNewPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Enter new password (min. 8 characters)"
                    required
                    disabled={loading}
                    autoFocus
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-crimson/20 focus:border-crimson"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Password strength bar */}
                {newPassword && (
                  <div className="space-y-1 pt-1.5">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-text-muted font-medium">Strength:</span>
                      <span className={passwordStrength.colorClass + ' font-bold'}>
                        {passwordStrength.label}
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${passwordStrength.bgClass} transition-all duration-300`}
                        style={{ width: `${(passwordStrength.score / 3) * 100}%` }}
                      />
                    </div>
                    <p className="text-[10px] text-text-muted leading-tight">
                      {passwordStrength.feedback}
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="reset-confirm-password" className="block text-xs font-bold text-text-primary">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="reset-confirm-password" autoComplete="new-password" maxLength={128}
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="Re-enter your new password"
                    required
                    disabled={loading}
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-border bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-crimson/20 focus:border-crimson"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary p-1"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                loading={loading}
                disabled={loading || !newPassword || !confirmPassword}
                className="w-full py-3 text-sm font-semibold flex items-center justify-center space-x-2"
              >
                <span>Reset Password</span>
                <ArrowRight size={18} />
              </Button>
            </form>
          )}

          {/* STEP 4: Success */}
          {step === 'SUCCESS' && (
            <div className="space-y-6 text-center py-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-sm animate-in zoom-in duration-300">
                <CheckCircle size={36} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold font-serif text-text-primary">
                  Password Reset Successful
                </h2>
                <p className="text-xs text-text-muted leading-relaxed max-w-sm mx-auto">
                  Your password has been securely updated. You can now log in to the TESTIMONIUM Parishioner Portal with your new credentials.
                </p>
              </div>
              <Button
                onClick={() => navigate('/login')}
                className="w-full py-3 text-sm font-semibold"
              >
                Return to Login
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
