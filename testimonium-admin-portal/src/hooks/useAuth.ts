import { useContext } from 'react';
import { AuthContext, type AuthContextValue } from '@/context/AuthContext';

/**
 * The single authentication interface for all page and component consumers.
 *
 * Must be called within an <AuthProvider> — throws otherwise.
 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return ctx;
}
