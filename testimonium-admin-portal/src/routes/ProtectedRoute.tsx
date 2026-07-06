import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { LoadingOverlay } from '@/components/ui/LoadingOverlay';

/**
 * ProtectedRoute — guards all admin routes.
 *
 * - While auth state is loading → full-screen spinner
 * - Not authenticated         → redirect to login
 * - Authenticated             → render the child route
 *
 * Future role-based restrictions can be added here via the `role` from useAuth.
 */
export function ProtectedRoute() {
  const { currentUser, loading } = useAuth();

  if (loading) {
    return <LoadingOverlay />;
  }

  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
