import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../components/ui/Button';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const isLoginPage = location.pathname === '/login';
  const isSignupPage = location.pathname === '/signup';
  const isAuthPage = isLoginPage || isSignupPage;

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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <Link
                to="/"
                className="flex items-center focus-ring rounded-md text-left group"
                aria-label="TESTIMONIUM Home"
              >
                <span className="font-serif font-black text-2xl sm:text-3xl text-crimson tracking-wider leading-none group-hover:opacity-90 transition-opacity">
                  TESTIMONIUM
                </span>
              </Link>
            </div>

            <nav className="flex items-center space-x-3 sm:space-x-4" aria-label="Public Navigation">
              {isAuthPage ? (
                isLoginPage ? (
                  <Button
                    size="sm"
                    onClick={() => navigate('/signup')}
                    className="min-h-[40px] px-4 font-semibold"
                  >
                    Register
                  </Button>
                ) : (
                  <Link
                    to="/login"
                    className="text-sm font-semibold text-crimson hover:underline px-3 py-2 focus-ring rounded-md min-h-[40px] flex items-center"
                  >
                    Log In
                  </Link>
                )
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-sm font-semibold text-text-primary hover:text-crimson transition-colors focus-ring px-3 py-2 rounded-md min-h-[40px] flex items-center"
                  >
                    Log In
                  </Link>
                  <Button
                    size="sm"
                    onClick={() => navigate('/signup')}
                    className="min-h-[40px] px-4 font-semibold shadow-sm"
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
