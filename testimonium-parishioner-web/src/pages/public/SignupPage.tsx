import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ShieldAlert, UserPlus, Eye, EyeOff, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

export const SignupPage: React.FC = () => {
  const { signUpWithEmail, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      setError('Please fill in all fields.');
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
    setError('');

    try {
      await signUpWithEmail(email, password, name);
      setSuccessMessage('Account registered successfully! Redirecting to complete your profile...');
      setTimeout(() => {
        navigate('/dashboard/profile', { state: { isNewUser: true } });
      }, 1500);
    } catch (err: any) {
      if (err?.code === 'auth/email-already-in-use') {
        setError('An account with this email address already exists. Redirecting to Login...');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err?.message || 'Registration failed. Please check your inputs.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError('');
    try {
      await signInWithGoogle();
      navigate('/dashboard/profile', { state: { isNewUser: true } });
    } catch (err: any) {
      if (err?.code === 'auth/account-exists-with-different-credential' || err?.code === 'auth/email-already-in-use') {
        setError('An account with this email address already exists. Please log in using your primary sign-in method.');
        setTimeout(() => navigate('/login'), 2000);
      } else {
        setError(err?.message || 'Google Sign-In failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] grid grid-cols-1 md:grid-cols-12 bg-app-base">
      {/* Left side - Branding (Hidden on mobile) */}
      <div className="hidden md:flex md:col-span-5 bg-sidebar-bg text-white flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-sidebar-dark/45 z-0" />
        <div className="absolute -bottom-20 -left-20 w-84 h-84 border-4 border-white/5 rounded-full z-0" />

        <div className="relative z-10 space-y-3">
          <span className="text-[10px] font-bold tracking-widest text-white/60 uppercase">
            Diocese Administration
          </span>
          <h2 className="text-3xl font-serif font-black tracking-wide">
            TESTIMONIUM
          </h2>
        </div>

        <div className="relative z-10 space-y-6">
          <UserPlus size={48} className="text-white/80" />
          <h3 className="text-2xl font-serif font-bold leading-snug">
            Create Your Parishioner Account
          </h3>
          <p className="text-xs text-white/60 max-w-sm leading-relaxed">
            Gain immediate access to certificate request forms, booking services, and status updates for your records.
          </p>
        </div>

        <div className="relative z-10 text-[10px] text-white/40">
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
            <div className="p-3.5 bg-green-50 border border-green-300 text-green-800 rounded-button flex items-start space-x-2.5 text-xs font-medium animate-in fade-in duration-fast">
              <CheckCircle size={16} className="mt-0.5 flex-shrink-0 text-green-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-50 border border-status-rejected/25 text-status-rejected rounded-button flex items-start space-x-2.5 text-xs font-medium animate-in fade-in duration-fast">
              <ShieldAlert size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              placeholder="e.g. Juan dela Cruz"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              disabled={loading}
              className="w-full"
            />
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
                label="Password (min. 6 characters)"
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
            <div className="relative">
              <Input
                label="Confirm Password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                disabled={loading}
                className="w-full pr-10"
              />
            </div>

            <Button type="submit" loading={loading} className="w-full pt-2.5 pb-2.5 mt-4">
              Register Account
            </Button>
          </form>

          <div className="relative flex py-2 items-center text-xs text-text-muted justify-center">
            <div className="flex-grow border-t border-border" />
            <span className="flex-shrink mx-4">or continue with</span>
            <div className="flex-grow border-t border-border" />
          </div>

          <Button
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center space-x-2"
          >
            {/* Google Icon SVG */}
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
    </div>
  );
};
export default SignupPage;
