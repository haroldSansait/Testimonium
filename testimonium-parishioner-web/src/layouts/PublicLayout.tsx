import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';
  const isSignupPage = location.pathname === '/signup';
  const isForgotPasswordPage = location.pathname === '/forgot-password' || location.pathname.startsWith('/forgot-password/');
  const isVerifyEmailPage = location.pathname === '/verify-email' || location.pathname.startsWith('/verify-email/');
  const isAuthPage = isLoginPage || isSignupPage || isForgotPasswordPage || isVerifyEmailPage;

  return (
    <div className="min-h-screen flex flex-col bg-app-base">
      {/* Skip to Content for Public Layout */}
      <a
        href="#main-public-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[99999] focus:bg-white focus:text-crimson focus:px-4 focus:py-2 focus:rounded-md focus:shadow-lg focus:ring-2 focus:ring-crimson font-medium text-sm transition-all"
      >
        Skip to content
      </a>

      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-30 shadow-xs">
        <div className={isAuthPage ? "w-full px-4 sm:px-6 md:px-10 lg:px-12" : "max-w-7xl mx-auto px-3 sm:px-6 lg:px-8"}>
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              {isAuthPage ? (
                <Link
                  to="/"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-crimson transition-colors focus-ring px-2.5 py-1.5 rounded-button bg-app-page/60 hover:bg-red-50/60 border border-border/70 -ml-1 sm:-ml-2.5 whitespace-nowrap"
                  aria-label="Return to landing page"
                >
                  <ArrowLeft size={14} />
                  <span>Back to Landing Page</span>
                </Link>
              ) : (
                <Link
                  to="/"
                  className="flex items-center focus-ring rounded-md text-left group"
                  aria-label="TESTIMONIUM Home"
                >
                  <span className="font-serif font-black text-xl sm:text-3xl text-crimson tracking-wide sm:tracking-wider leading-none group-hover:opacity-90 transition-opacity whitespace-nowrap">
                    TESTIMONIUM
                  </span>
                </Link>
              )}
            </div>

            <nav className="flex items-center gap-1.5 sm:gap-4 shrink-0" aria-label="Public Navigation">
              {isAuthPage ? (
                isLoginPage ? (
                  <Button
                    size="sm"
                    onClick={() => navigate('/signup')}
                    className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 text-xs sm:text-sm font-semibold whitespace-nowrap shadow-sm"
                  >
                    Register
                  </Button>
                ) : (
                  <Link
                    to="/login"
                    className="text-xs sm:text-sm font-semibold text-crimson hover:underline px-2.5 sm:px-3 py-1.5 sm:py-2 focus-ring rounded-md min-h-[38px] sm:min-h-[40px] flex items-center whitespace-nowrap"
                  >
                    Log In
                  </Link>
                )
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-xs sm:text-sm font-semibold text-text-primary hover:text-crimson transition-colors focus-ring px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-md min-h-[38px] sm:min-h-[40px] flex items-center whitespace-nowrap shrink-0"
                  >
                    Log In
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => navigate('/signup')}
                    className="min-h-[38px] sm:min-h-[40px] px-3 sm:px-4 text-xs sm:text-sm font-semibold shadow-sm whitespace-nowrap shrink-0"
                  >
                    Register
                  </Button>
                </>
              )}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-public-content" className="flex-grow focus:outline-none" tabIndex={-1}>
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-border py-8 text-center text-xs text-text-muted">
        <div className="max-w-7xl mx-auto px-4 space-y-3">
          <p className="font-serif font-semibold text-text-primary tracking-wide text-sm">
            Roman Catholic Diocese of San Carlos
          </p>
          <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs font-medium text-text-muted">
            <Link to="/login" className="hover:text-crimson transition-colors focus-ring rounded px-1">
              Log In
            </Link>
            <Link to="/signup" className="hover:text-crimson transition-colors focus-ring rounded px-1">
              Register
            </Link>
            <Link to="/terms" className="hover:text-crimson transition-colors focus-ring rounded px-1">
              Terms of Service
            </Link>
            <Link to="/privacy" className="hover:text-crimson transition-colors focus-ring rounded px-1">
              Privacy Policy
            </Link>
          </div>
          <p className="text-text-muted/70 text-[11px] pt-1">
            TESTIMONIUM Parishioner Web Portal &copy; {new Date().getFullYear()}. All Rights Reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default PublicLayout;
