import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, UserPlus, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { LegalAcceptanceModal } from '../../components/modals/LegalAcceptanceModal';
import { TermsModal } from '../../components/modals/TermsModal';
import { PrivacyModal } from '../../components/modals/PrivacyModal';
import { mapAuthError } from '../../utils/authErrorMapper';
import mtKanlaonImage from '../../assets/Mt_Kanlaon.png';

export const SignupPage: React.FC = () => {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  // Structured name fields
  const [firstName, setFirstName] = useState('');
  const [middleName, setMiddleName] = useState('');
  const [lastName, setLastName] = useState('');
  const [suffix, setSuffix] = useState('');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Legal compliance checkboxes
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);

  // Cooldown and UI states
  const [loading, setLoading] = useState(false);
  const [submitCooldown, setSubmitCooldown] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modal states
  const [isLegalModalOpen, setIsLegalModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isPrivacyModalOpen, setIsPrivacyModalOpen] = useState(false);



  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (submitCooldown || loading) return;

    if (!firstName.trim() || !lastName.trim()) {
      setError('First Name and Last Name are required.');
      return;
    }

    if (!email || !password || !confirmPassword) {
      setError('Please fill in all required fields.');
      return;
    }

    if (!termsAccepted || !privacyAccepted) {
      setError('You must accept both the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setSubmitCooldown(true);
    setError('');

    // Activate 2.5s submit cooldown to prevent duplicate registration requests
    setTimeout(() => setSubmitCooldown(false), 2500);

    try {
      await signUpWithEmail(
        email, 
        password, 
        {
          firstName: firstName.trim(),
          middleName: middleName.trim() || undefined,
          lastName: lastName.trim(),
          suffix: suffix.trim() || undefined,
        },
        {
          termsAccepted: true,
          privacyAccepted: true,
          termsVersion: 'v1.0',
          privacyVersion: 'v1.0',
        }
      );

      setSuccessMessage('Registration successful! Redirecting to email verification...');
      setTimeout(() => {
        navigate('/verify-email');
      }, 1000);
    } catch (err: any) {
      setError(mapAuthError(err, 'Registration failed. Please check your inputs.'));
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteGoogleSignIn = async () => {
    setIsLegalModalOpen(false);
    setLoading(true);
    setError('');

    try {
      await signInWithGoogle();
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

  const isFormValid = termsAccepted && privacyAccepted && firstName.trim() !== '' && lastName.trim() !== '' && !loading && !submitCooldown;

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 bg-app-base">
      {/* Left side - Branding */}
      <div 
        className="hidden md:flex md:col-span-5 text-white flex-col justify-center items-center text-center p-12 relative overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(rgba(123, 28, 42, 0.88), rgba(123, 28, 42, 0.92)), url(${mtKanlaonImage})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="absolute inset-0 bg-black/10 z-0" />
        <div className="absolute -bottom-20 -left-20 w-84 h-84 border-4 border-white/5 rounded-full z-0" />

        <div className="relative z-10 space-y-6 max-w-md flex flex-col items-center animate-in fade-in duration-700">
          <UserPlus size={56} className="text-white/85" />
          <h3 className="text-3xl md:text-4xl font-serif font-bold leading-tight">
            Create Your Parishioner Account
          </h3>
          <p className="text-sm sm:text-base text-white/80 leading-relaxed font-normal">
            Gain immediate access to certificate request forms, booking services, and status updates for your records.
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
              Register Account
            </h1>
            <p className="text-sm text-text-muted">
              Enter your details to create your secure parishioner profile.
            </p>
          </div>

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-button flex items-start space-x-2.5 text-xs font-semibold shadow-sm animate-in fade-in">
              <CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-50 border border-red-300 text-red-900 rounded-button flex items-start space-x-2.5 text-xs font-semibold shadow-sm animate-in fade-in">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name *"
                type="text"
                placeholder="Juan"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                disabled={loading}
                className="w-full"
              />
              <Input
                label="Middle Name"
                type="text"
                placeholder="Santos (Optional)"
                value={middleName}
                onChange={(e) => setMiddleName(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2">
                <Input
                  label="Last Name *"
                  type="text"
                  placeholder="dela Cruz"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  disabled={loading}
                  className="w-full"
                />
              </div>
              <Input
                label="Suffix"
                type="text"
                placeholder="Jr. (Opt.)"
                value={suffix}
                onChange={(e) => setSuffix(e.target.value)}
                disabled={loading}
                className="w-full"
              />
            </div>

            <Input
              label="Email Address *"
              type="email"
              placeholder="e.g. name@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              className="w-full"
            />
            <div className="relative">
              <Input
                label="Password (min. 6 characters) *"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-8 text-text-muted hover:text-text-primary transition-colors focus:outline-none"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            <div className="relative">
              <Input
                label="Confirm Password *"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full pr-10"
              />
            </div>

            {/* Mandatory Legal Compliance Checkboxes */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 shadow-sm space-y-3 pt-3">
              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus:ring-crimson cursor-pointer"
                />
                <span className="text-xs text-gray-900 font-medium leading-snug">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="font-bold text-crimson hover:underline focus:outline-none"
                  >
                    Terms of Service
                  </button>
                </span>
              </label>

              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={privacyAccepted}
                  onChange={(e) => setPrivacyAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus:ring-crimson cursor-pointer"
                />
                <span className="text-xs text-gray-900 font-medium leading-snug">
                  I acknowledge the{' '}
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="font-bold text-crimson hover:underline focus:outline-none"
                  >
                    Privacy Policy
                  </button>
                </span>
              </label>
            </div>

            <Button
              type="submit"
              loading={loading}
              disabled={!isFormValid}
              className="w-full pt-2.5 pb-2.5 mt-4"
            >
              {submitCooldown ? 'Processing...' : 'Register Account'}
            </Button>
          </form>

          <div className="relative flex py-2 items-center text-xs text-text-muted justify-center">
            <div className="flex-grow border-t border-border" />
            <span className="flex-shrink mx-4">or continue with</span>
            <div className="flex-grow border-t border-border" />
          </div>

          <Button
            variant="outline"
            onClick={handleExecuteGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2"
          >
            <svg className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span>Sign Up with Google</span>
          </Button>

          <p className="text-center text-xs text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-crimson hover:underline focus-ring">
              Log In
            </Link>
          </p>
        </div>
      </div>

      {/* Legal Modals */}
      <TermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />
      <PrivacyModal
        isOpen={isPrivacyModalOpen}
        onClose={() => setIsPrivacyModalOpen(false)}
      />
      <LegalAcceptanceModal
        isOpen={isLegalModalOpen}
        onClose={() => setIsLegalModalOpen(false)}
        onAccept={handleExecuteGoogleSignIn}
      />
    </div>
  );
};

export default SignupPage;

