import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { mapAuthError } from '../../utils/authErrorMapper';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LegalAcceptanceModal } from '../../components/modals/LegalAcceptanceModal';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

export const LoginPage: React.FC = () => {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(false);

  const [loading, setLoading] = useState(false);
  const [submitCooldown, setSubmitCooldown] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmailError, setUnverifiedEmailError] = useState(false);

  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitCooldown || loading) return;

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);
    setSubmitCooldown(true);
    setError('');
    setUnverifiedEmailError(false);

    // Activate 2.5s submit cooldown
    setTimeout(() => setSubmitCooldown(false), 2500);

    try {
      await signInWithEmail(email, password, { keepSignedIn });
      // ProtectedRoute is single routing authority for dashboard vs profile completion
      navigate('/dashboard/home');
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED' || err?.message?.includes('verify your email')) {
        navigate('/verify-email', { replace: true });
        setUnverifiedEmailError(true);
        setError('Please verify your email address before signing in.');
      } else {
        setError(mapAuthError(err, 'Authentication failed. Please verify your credentials.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteGoogleSignIn = async (legalPayload?: any) => {
    if (submitCooldown || loading) return;
    setIsLegalModalOpen(false);
    setLoading(true);
    setSubmitCooldown(true);
    setError('');
    setUnverifiedEmailError(false);

    // Activate 2.5s submit cooldown
    setTimeout(() => setSubmitCooldown(false), 2500);

    try {
      await signInWithGoogle({ keepSignedIn, legal: legalPayload });
      // ProtectedRoute is single routing authority for dashboard vs profile completion
      navigate('/dashboard/home');
    } catch (err: any) {
      if (err?.code === 'LEGAL_ACCEPTANCE_REQUIRED' || err?.code === 'LEGAL_ACCEPTANCE_VERSION_CONFLICT') {
        setIsLegalModalOpen(true);
      } else {
        setError(mapAuthError(err, 'Google Sign-In failed.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const brandingPoints = [
    'Secure Sacramental Document Processing',
    'Direct Canonical Scheduling with Priests',
    'Real-Time Certificate Status Tracking',
    'Vicariate Parish Information & Mass Times'
  ];

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 bg-app-base">
      {/* Left side - Branding (Hidden on mobile) */}
      <div
        className="hidden md:flex md:col-span-5 text-white flex-col justify-between p-10 lg:p-12 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(107, 15, 26, 0.90), rgba(74, 10, 18, 0.95)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="relative z-10">
          <span className="font-serif font-black text-2xl tracking-wider block">
            TESTIMONIUM
          </span>
          <span className="text-xs text-white/70 tracking-wide font-sans">
            Parishioner Web Portal
          </span>
        </div>

        <div className="relative z-10 space-y-6 my-auto max-w-sm">
          <h2 className="text-2xl lg:text-3xl font-serif font-bold leading-snug">
            Welcome to the Parishioner Portal
          </h2>
          <p className="text-xs lg:text-sm text-white/80 leading-relaxed font-normal">
            Access ecclesiastical services and sacramental registries across the Vicariate of Canlaon.
          </p>

          <div className="space-y-3 pt-2">
            {brandingPoints.map((point, idx) => (
              <div key={idx} className="flex items-start gap-2.5 text-xs text-white/90 font-medium">
                <CheckCircle2 size={16} className="text-amber-400 flex-shrink-0 mt-0.5" />
                <span>{point}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[11px] text-white/50 pt-6">
          Roman Catholic Diocese of San Carlos &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* Right side - Form */}
      <div className="col-span-1 md:col-span-7 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md space-y-6 sm:space-y-8">
          <div className="space-y-1.5 text-left">
            <h1 className="text-2xl sm:text-3xl font-serif font-bold text-text-primary">
              Log In to Portal
            </h1>
            <p className="text-xs sm:text-sm text-text-muted">
              Enter your credentials to access your parishioner dashboard.
            </p>
          </div>

          {unverifiedEmailError ? (
            <div className="p-4 bg-amber-50 border-l-4 border-amber-500 border border-amber-200 text-amber-950 rounded-card space-y-3 shadow-xs text-left animate-in fade-in">
              <div className="flex items-start space-x-2.5 text-xs font-bold text-amber-950">
                <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-amber-700" />
                <span>Email Verification Required</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                Your email address has not been verified yet. Please check your email inbox or request a verification code.
              </p>
              <div className="pt-1">
                <Button
                  onClick={() => navigate('/verify-email')}
                  className="w-full text-xs py-2 bg-amber-700 hover:bg-amber-800 text-white flex items-center justify-center space-x-1.5 font-semibold shadow-xs"
                >
                  <span>Go to Email Verification</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          ) : error ? (
            <div className="p-3.5 bg-red-50 border-l-4 border-status-rejected border border-red-200 text-red-900 rounded-card flex items-start space-x-2.5 text-xs font-semibold shadow-xs text-left animate-in fade-in">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-status-rejected" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <Input
              label="Email Address"
              type="email"
              placeholder="e.g. name@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full"
            />

            <div className="relative">
              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[42px] text-text-muted hover:text-text-primary transition-colors focus-ring rounded-md p-1"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="space-y-1 pt-1">
              <div className="flex items-center justify-between text-xs">
                <label className="flex items-center space-x-2 text-text-muted select-none cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepSignedIn}
                    onChange={e => setKeepSignedIn(e.target.checked)}
                    disabled={loading}
                    className="rounded border-border text-crimson focus-ring w-4 h-4 cursor-pointer disabled:opacity-50"
                  />
                  <span className="text-text-primary font-medium">Keep me signed in on this device</span>
                </label>
                <Link
                  to="/forgot-password"
                  className="font-semibold text-crimson hover:underline focus-ring rounded px-1 py-0.5"
                >
                  Forgot Password?
                </Link>
              </div>
              <p className="text-[11px] text-text-muted pl-6">
                Use this only on a private device.
              </p>
            </div>

            <Button
              type="submit"
              loading={loading}
              disabled={submitCooldown || loading}
              className="w-full pt-2.5 pb-2.5 mt-2 font-semibold shadow-sm"
            >
              {submitCooldown && !loading ? 'Verifying...' : 'Log In'}
            </Button>
          </form>

          <div className="relative flex py-1 items-center text-xs text-text-muted justify-center">
            <div className="flex-grow border-t border-border" />
            <span className="flex-shrink mx-4 font-medium text-text-muted/80">or continue with</span>
            <div className="flex-grow border-t border-border" />
          </div>

          <Button
            variant="outline"
            onClick={() => handleExecuteGoogleSignIn()}
            disabled={loading || submitCooldown}
            className="w-full flex items-center justify-center space-x-2 font-semibold hover:bg-app-page"
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign In with Google</span>
          </Button>

          <p className="text-center text-xs text-text-muted">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-crimson hover:underline focus-ring rounded px-1">
              Create one now
            </Link>
          </p>
        </div>
      </div>

      {/* Pre-Google Sign-In Legal Modal (Shown only for new users registering via Google from login page) */}
      <LegalAcceptanceModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        onAccept={(payload) => handleExecuteGoogleSignIn(payload)}
      />
    </div>
  );
};

export default LoginPage;
