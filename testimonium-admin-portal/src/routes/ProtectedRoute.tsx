import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';
import { hasPermission } from '@/permissions/rolePermissions';
import type { Permission } from '@/permissions/permissions';
import { useSyncExternalStore } from 'react';
import { getQueryScope, subscribeQueryScope } from '@/services/queryClient';
import { ErrorState } from '@/components/common/ErrorState';

interface ProtectedRouteProps {
  /**
   * When provided, the authenticated user's role must have this permission.
   * If it does not, they are redirected to /unauthorized instead of the backend
   * returning a 403 error.
   *
   * Omit this prop for routes that only require authentication (no role gate).
   */
  requiredPermission?: Permission;
}

/**
 * ProtectedRoute — guards all admin routes.
 *
 * - While auth state is loading → full-screen spinner
 * - Not authenticated         → redirect to login
 * - Missing required permission → redirect to /unauthorized
 * - Authenticated + permitted   → render the child route
 */
export function ProtectedRoute({ requiredPermission }: ProtectedRouteProps) {
  const { currentUser, applicationUser, profileError, refreshUser, role, loading } = useAuth();
  const cacheScope = useSyncExternalStore(subscribeQueryScope, getQueryScope);

  if (loading || (currentUser && !applicationUser && !profileError)) {
    return <LoadingOverlay />;
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  if (profileError) {
    return <ErrorState message={profileError.message} onRetry={() => { void refreshUser(); }} />;
  }

  if (requiredPermission && !hasPermission(role, requiredPermission)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <Outlet key={cacheScope ?? 'anonymous'} />;
}
