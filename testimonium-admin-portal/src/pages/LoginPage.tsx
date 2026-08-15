import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, LogIn, KeyRound } from 'lucide-react';
import logoUrl from '@/assets/TESTIMONIUM_logo.png';
import { useAuth } from '@/hooks/useAuth';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

import { mapAuthError } from '@/utils/authErrorMapper';

export function LoginPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      await signIn(data.email, data.password, data.rememberMe);
      navigate('/dashboard');
    } catch (err: unknown) {
      setServerError(mapAuthError(err));
    }
  };

  useEffect(() => {
    if (!showForgotModal) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowForgotModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    // Auto-focus the close button
    setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showForgotModal]);

  const handleTabKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault(); // Trap focus inside this single-button modal
    }
  };

  return (
    <div className="w-full max-w-[420px] bg-white rounded-2xl shadow-lg border border-gray-100 px-8 py-10">
      {/* Logo + Branding */}
      <div className="flex flex-col items-center mb-8">
        <img
          src={logoUrl}
          alt="TESTIMONIUM Logo"
          className="w-20 h-20 rounded-full object-cover mb-4 shadow-md"
        />
        <h1
          className="text-2xl font-bold tracking-widest text-gray-900 uppercase"
          style={{ fontFamily: 'Playfair Display, serif', letterSpacing: '0.15em' }}
        >
          TESTIMONIUM
        </h1>
        <p className="text-sm text-gray-400 mt-1">Parish Administrative Portal</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="login-email">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="admin@parish.org"
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all"
              {...register('email')}
            />
          </div>
          {errors.email && (
            <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5" htmlFor="login-password">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full pl-10 pr-11 py-2.5 border border-gray-300 rounded-md text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-crimson-700/20 focus:border-crimson-700 transition-all"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              id="toggle-password"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && (
            <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
          )}
        </div>

        {/* Remember Me + Forgot Password */}
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              id="login-remember-me"
              className="w-4 h-4 rounded border-gray-300 text-crimson-700 focus:ring-crimson-700/20 focus:ring-2"
              {...register('rememberMe')}
            />
            <span className="text-sm text-gray-600">Remember me</span>
          </label>
          <button
            type="button"
            onClick={() => setShowForgotModal(true)}
            id="forgot-password"
            className="text-sm font-medium text-crimson-700 hover:text-crimson-800 transition-colors"
          >
            Forgot Password?
          </button>
        </div>

        {/* Server / backend error */}
        {serverError && (
          <p
            id="login-error"
            role="alert"
            className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
          >
            {serverError}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          id="login-submit"
          disabled={isSubmitting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-crimson-700 text-white text-sm font-semibold rounded-md hover:bg-crimson-800 focus:outline-none focus:ring-2 focus:ring-crimson-700 focus:ring-offset-2 transition-all duration-150 active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
          ) : (
            <>
              Login <LogIn className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Footer */}
      <p className="text-center text-[10px] font-semibold tracking-widest text-gray-400 uppercase mt-8">
        CONFIDENTIAL &amp; OFFICIAL USE ONLY
      </p>

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={(e) => e.target === e.currentTarget && setShowForgotModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-in fade-in zoom-in-95 duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="forgot-password-title"
          >
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <KeyRound className="w-6 h-6 text-crimson-700" />
            </div>
            <h3
              id="forgot-password-title"
              className="text-base font-bold text-gray-900 mb-2"
              style={{ fontFamily: 'Playfair Display, serif' }}
            >
              Password Recovery
            </h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Password recovery via email is not yet available.
              <br />
              Please contact your Diocese Coordinator to request a password reset.
              <br />
              This feature will be available in a future update.
            </p>
            <div className="flex justify-center">
              <button
                ref={closeButtonRef}
                onClick={() => setShowForgotModal(false)}
                onKeyDown={handleTabKey}
                className="w-full px-4 py-2.5 bg-crimson-700 hover:bg-crimson-800 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-crimson-700 focus:ring-offset-2"
                id="forgot-password-close"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
