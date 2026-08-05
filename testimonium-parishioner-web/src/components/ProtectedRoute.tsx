import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from './ui/Spinner';

export const ProtectedRoute: React.FC = () => {
  const { user, appProfile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-app-page">
        <Spinner size="lg" className="text-crimson" />
        <p className="mt-4 text-sm text-text-muted font-medium">Verifying credentials & legal compliance...</p>
      </div>
    );
  }

  if (!user) {
    console.debug('[ProtectedRoute] No user session found. Redirecting to /login');
    return <Navigate to="/login" replace />;
  }

  // 1. Check email verification for Email/Password provider users
  const isPasswordProvider = user.providerData.some((p) => p.providerId === 'password');
  const isEmailVerified = Boolean(user.emailVerified || appProfile?.emailVerified);

  if (isPasswordProvider && !isEmailVerified) {
    console.debug('[ProtectedRoute] Email not verified. Redirecting to /verify-email');
    return <Navigate to="/verify-email" replace />;
  }

  // 2. Check profile completion requirement
  if (appProfile?.needsProfileCompletion && location.pathname !== '/dashboard/profile') {
    console.debug('[ProtectedRoute] Profile completion required. Redirecting to /dashboard/profile');
    return <Navigate to="/dashboard/profile" state={{ isNewUser: true }} replace />;
  }

  console.debug('[ProtectedRoute] Access granted to route:', location.pathname);
  return <Outlet />;
};

export default ProtectedRoute;
