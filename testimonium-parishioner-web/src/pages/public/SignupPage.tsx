import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, Eye, EyeOff, CheckCircle, CheckCircle2 } from 'lucide-react';
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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

  const handleExecuteGoogleSignIn = async (legalPayload?: any) => {
    if (submitCooldown || loading) return;
    setIsLegalModalOpen(false);
    setLoading(true);
    setSubmitCooldown(true);
    setError('');

    // Activate 2.5s submit cooldown
    setTimeout(() => setSubmitCooldown(false), 2500);

    try {
      await signInWithGoogle({ keepSignedIn: true, legal: legalPayload });
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

  const isFormValid = termsAccepted && privacyAccepted && firstName.trim() !== '' && lastName.trim() !== '' && email.trim() !== '' && password.length >= 6 && confirmPassword === password && !loading && !submitCooldown;

  const brandingPoints = [
    'Immediate Access to Certificate Requests',
    'Canonical Interview & Blessing Booking',
    'Full Status Transparency for Your Records',
    'Direct Link to Vicariate Parish Offices'
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
            Create Your Parishioner Account
          </h2>
          <p className="text-xs lg:text-sm text-white/80 leading-relaxed font-normal">
            Gain immediate access to certificate request forms, booking services, and status updates for your records.
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
              Register Account
            </h1>
            <p className="text-xs sm:text-sm text-text-muted">
              Enter your details to create your secure parishioner profile.
            </p>
          </div>

          {successMessage && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-300 text-emerald-900 rounded-card flex items-start space-x-2.5 text-xs font-semibold shadow-xs text-left animate-in fade-in">
              <CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-50 border-l-4 border-status-rejected border border-red-200 text-red-900 rounded-card flex items-start space-x-2.5 text-xs font-semibold shadow-xs text-left animate-in fade-in">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0 text-status-rejected" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            {/* Stacked on mobile (<640px), 2 columns on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

            {/* Stacked on mobile (<640px), 3 columns on sm+ */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
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
                label="Password *"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-[34px] text-text-muted hover:text-text-primary transition-colors focus-ring rounded-md p-1"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            <div className="relative">
              <Input
                label="Confirm Password *"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full pr-11"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-[34px] text-text-muted hover:text-text-primary transition-colors focus-ring rounded-md p-1"
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Honest Password Requirement Note */}
            <div className="text-[11px] text-text-muted bg-app-page px-3 py-2 rounded-lg border border-border/50 space-y-1">
              <span className="font-semibold text-text-primary">Password Requirement:</span>
              <p className={password.length >= 6 ? 'text-green-700 font-medium' : 'text-text-muted'}>
                • Must be at least 6 characters {password.length >= 6 && '✓'}
              </p>
              {confirmPassword.length > 0 && (
                <p className={password === confirmPassword ? 'text-green-700 font-medium' : 'text-red-600 font-medium'}>
                  • Passwords {password === confirmPassword ? 'match ✓' : 'do not match ✗'}
                </p>
              )}
            </div>

            {/* Mandatory Legal Compliance Checkboxes */}
            <div className="p-4 bg-app-page rounded-card border border-border space-y-3 shadow-xs">
              <div className="flex items-center gap-1.5 pb-1 border-b border-border/40">
                <span className="text-xs font-bold text-text-primary">Legal Terms &amp; Privacy Consent</span>
                <span className="text-crimson text-xs font-bold">*</span>
              </div>

              <label className="flex items-start space-x-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => setTermsAccepted(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus-ring cursor-pointer"
                />
                <span className="text-xs text-text-primary font-medium leading-snug">
                  I agree to the{' '}
                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="font-bold text-crimson hover:underline focus-ring rounded px-0.5"
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
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-crimson focus-ring cursor-pointer"
                />
                <span className="text-xs text-text-primary font-medium leading-snug">
                  I acknowledge the{' '}
                  <button
                    type="button"
                    onClick={() => setIsPrivacyModalOpen(true)}
                    className="font-bold text-crimson hover:underline focus-ring rounded px-0.5"
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
              className="w-full pt-2.5 pb-2.5 mt-4 font-semibold shadow-sm"
            >
              {submitCooldown ? 'Processing...' : 'Register Account'}
            </Button>

            {!isFormValid && (
              <p className="text-[11px] text-text-muted text-center italic">
                Please complete required fields (*), ensure passwords match (min. 6 characters), and accept the legal policies.
              </p>
            )}
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
            <span>Sign Up with Google</span>
          </Button>

          <p className="text-center text-xs text-text-muted">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-crimson hover:underline focus-ring rounded px-1">
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
