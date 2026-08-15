import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, BookOpen, Eye, EyeOff, ArrowRight } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { mapAuthError } from '../../utils/authErrorMapper';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { LegalAcceptanceModal } from '../../components/modals/LegalAcceptanceModal';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

export const LoginPage: React.FC = () => {
  const { signInWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  
  const [loading, setLoading] = useState(false);
  const [submitCooldown, setSubmitCooldown] = useState(false);
  const [error, setError] = useState('');
  const [unverifiedEmailError, setUnverifiedEmailError] = useState(false);

  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
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
      await signInWithEmail(email, password);
      // ProtectedRoute is single routing authority for dashboard vs profile completion
      navigate('/dashboard/home');
    } catch (err: any) {
      if (err?.code === 'EMAIL_NOT_VERIFIED' || err?.message?.includes('verify your email')) {
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
    setIsLegalModalOpen(false);
    setLoading(true);
    setError('');
    setUnverifiedEmailError(false);

    try {
      await signInWithGoogle(legalPayload);
      // ProtectedRoute is single routing authority for dashboard vs profile completion
      navigate('/dashboard/home');
    } catch (err: any) {
      if (err?.code === 'LEGAL_ACCEPTANCE_REQUIRED') {
        setIsLegalModalOpen(true);
      } else {
        setError(mapAuthError(err, 'Google Sign-In failed.'));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 bg-app-base">
      {/* Left side - Branding (Hidden on mobile) */}
      <div 
        className="hidden md:flex md:col-span-5 text-white flex-col justify-center items-center text-center p-12 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(123, 28, 42, 0.88), rgba(123, 28, 42, 0.92)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      >
        <div className="absolute inset-0 bg-black/10 z-0" />
        <div className="absolute -bottom-20 -left-20 w-84 h-84 border-4 border-white/5 rounded-full z-0" />

        <div className="relative z-10 space-y-6 max-w-md flex flex-col items-center animate-in fade-in duration-700">
          <BookOpen size={56} className="text-white/85" />
          <h3 className="text-3xl md:text-4xl font-serif font-bold leading-tight">
            "Reverence, Transparency, and Efficiency in Service of the Faithful"
          </h3>
          <p className="text-sm sm:text-base text-white/80 leading-relaxed font-normal">
            Managing sacramental registrations, certificates, and appointments securely for the Vicariate of Canlaon.
          </p>
        </div>

        <div className="absolute bottom-12 left-0 right-0 text-center z-10 text-[10px] text-white/40">
          Roman Catholic Diocese of San Carlos &copy; {new Date().getFullYear()}
        </div>
      </div>

      {/* Right side - Form */}
      <div className="col-span-1 md:col-span-7 flex items-center justify-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl font-serif font-bold text-text-primary">
              Log In to Portal
            </h1>
            <p className="text-sm text-text-muted">
              Enter your credentials to access your parishioner dashboard.
            </p>
          </div>

          {unverifiedEmailError ? (
            <div className="p-4 bg-amber-50 border border-amber-300 text-amber-950 rounded-xl space-y-3 shadow-sm animate-in fade-in">
              <div className="flex items-start space-x-2.5 text-xs font-bold text-amber-950">
                <ShieldAlert size={18} className="mt-0.5 flex-shrink-0 text-amber-700" />
                <span>Email Verification Required</span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed font-medium">
                Your email address has not been verified yet. Please check your email inbox or resend the verification link.
              </p>
              <div className="pt-1">
                <Button
                  onClick={() => navigate('/verify-email')}
                  className="w-full text-xs py-2 bg-amber-700 hover:bg-amber-800 text-white flex items-center justify-center space-x-1.5 font-semibold shadow-sm"
                >
                  <span>Go to Email Verification</span>
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          ) : error ? (
            <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 rounded-button flex items-start space-x-2.5 text-xs font-semibold shadow-sm animate-in fade-in">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          ) : null}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                className="w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-text-muted hover:text-text-primary transition-colors focus:outline-none"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 text-text-muted select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded border-border text-crimson focus-ring w-4 h-4 cursor-pointer"
                />
                <span>Remember Me</span>
              </label>
              <button
                type="button"
                onClick={() => setIsForgotModalOpen(true)}
                className="font-medium text-crimson hover:underline focus-ring"
              >
                Forgot Password?
              </button>
            </div>

            <Button 
              type="submit" 
              loading={loading} 
              disabled={submitCooldown}
              className="w-full pt-2.5 pb-2.5 mt-2"
            >
              {submitCooldown ? 'Verifying...' : 'Log In'}
            </Button>
          </form>

          <div className="relative flex py-2 items-center text-xs text-text-muted justify-center">
            <div className="flex-grow border-t border-border" />
            <span className="flex-shrink mx-4">or continue with</span>
            <div className="flex-grow border-t border-border" />
          </div>

          <Button
            variant="outline"
            onClick={() => handleExecuteGoogleSignIn()}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2"
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign In with Google</span>
          </Button>

          <p className="text-center text-xs text-text-muted">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-crimson hover:underline focus-ring">
              Create one now
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={isForgotModalOpen}
        onClose={() => setIsForgotModalOpen(false)}
        title="Forgot Password"
      >
        <div className="space-y-4 text-sm text-text-primary">
          <p>
            For security reasons and to safeguard parishioner registries, password reset services are controlled via official coordination.
          </p>
          <div className="p-3 bg-red-50 text-crimson rounded-button border border-crimson/10 font-semibold text-xs leading-relaxed">
            Please contact your Diocese Coordinator or your local Parish Secretary for assistance in resetting your password.
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => setIsForgotModalOpen(false)}>
              Understood
            </Button>
          </div>
        </div>
      </Modal>

      {/* Pre-Google Sign-In Legal Modal (Shown only for new users registering via Google from login page) */}
      <LegalAcceptanceModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        onAccept={() => handleExecuteGoogleSignIn({
          termsAccepted: true,
          privacyAccepted: true,
          termsVersion: 'v1.0',
          privacyVersion: 'v1.0',
        })}
      />
    </div>
  );
};

export default LoginPage;
