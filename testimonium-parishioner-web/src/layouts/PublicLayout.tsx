import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-app-base">
      {/* Header */}
      <header className="bg-white border-b border-border sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center space-x-3">
              <Link to="/" className="flex items-center space-x-2.5 focus-ring rounded-md">
                <span className="font-serif font-bold text-xl text-crimson tracking-wide">
                  TESTIMONIUM
                </span>
                <span className="text-xs font-semibold px-2 py-0.5 bg-red-50 text-crimson rounded-full border border-crimson/10 uppercase tracking-wider hidden sm:inline-block">
                  Parishioner Portal
                </span>
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <Button variant="ghost" size="sm" onClick={logout}>
                  Sign Out
                </Button>
              ) : (
                <>
                  <Link to="/login" className="text-sm font-medium text-text-muted hover:text-text-primary focus-ring px-2.5 py-1.5 rounded-md">
                    Log In
                  </Link>
                  <Button size="sm" onClick={() => navigate('/signup')}>
                    Register
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-border py-8 text-center text-xs text-text-muted">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-serif font-semibold text-text-primary tracking-wide text-sm">
            Roman Catholic Diocese of San Carlos
          </p>
          <p>
            TESTIMONIUM Parishioner Web Portal &copy; {new Date().getFullYear()}. All Rights Reserved.
          </p>
          <p className="text-text-muted/60">
            Designed for secure ecclesiastical document management and sacramental scheduling.
          </p>
        </div>
      </footer>
    </div>
  );
};
export default PublicLayout;
