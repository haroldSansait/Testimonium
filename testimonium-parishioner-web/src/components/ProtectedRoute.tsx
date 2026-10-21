import React, { useSyncExternalStore } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spinner } from './ui/Spinner';
import { LegalGate } from './legal/LegalGate';
import { getQueryScope, subscribeQueryScope } from '../services/queryClient';
import { ProfileRequirementProvider } from '../contexts/ProfileRequirementContext';
import { NotificationProvider } from '../contexts/NotificationContext';
import { ErrorState } from './ui/ErrorState';

export const ProtectedRoute: React.FC = () => {
  const { user, appProfile, profileError, refreshProfile, loading } = useAuth();
  const cacheScope = useSyncExternalStore(subscribeQueryScope, getQueryScope);
  const location = useLocation();

  if (loading || (user && !appProfile && !profileError)) {
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

  if (profileError) {
    return <ErrorState description={profileError.message}
      onRetry={() => { void refreshProfile().catch(() => {}); }} />;
  }

  // 2. Legal compliance gating for authenticated parishioners
  // If either Terms or Privacy acceptance is missing or stale relative to authoritative DB, gate protected content
  if (appProfile?.role === 'PARISHIONER' && (!appProfile.termsAccepted || !appProfile.privacyAccepted)) {
    console.debug('[ProtectedRoute] Legal compliance missing or stale. Displaying LegalGate');
    return <LegalGate />;
  }

  // 3. Profile completion is enforced at request action boundaries (Document/Schedule requests),
  // allowing normal browsing of Home, Directory, Help, and Profile.
  console.debug('[ProtectedRoute] Access granted to route:', location.pathname);
  return <ProfileRequirementProvider key={cacheScope ?? 'anonymous'}>
    <NotificationProvider><Outlet /></NotificationProvider>
  </ProfileRequirementProvider>;
};

export default ProtectedRoute;
