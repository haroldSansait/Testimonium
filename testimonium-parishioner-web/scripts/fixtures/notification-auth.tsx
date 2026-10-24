/* eslint-disable react/only-export-components -- Test-only controlled authentication boundary. */
import React, { createContext, useContext, useLayoutEffect, useState } from 'react';
import { setQueryScope } from '../../src/services/queryClient';

const AuthContext = createContext<any>(null);
export const useAuth = () => useContext(AuthContext);
export function FixtureAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>({ uid: 'fixture-a', displayName: 'Fixture Parishioner', email: 'fixture@example.test' });
  useLayoutEffect(() => {
    window.fixture.session = (uid: string | null) => {
      setQueryScope(uid, 'PARISHIONER', '3');
      setUser(uid ? { uid, displayName: uid, email: 'fixture@example.test' } : null);
    };
  }, []);
  return <AuthContext.Provider value={{ user, appProfile: { needsProfileCompletion: false }, logout: async () => window.fixture.session(null) }}>
    {children}
  </AuthContext.Provider>;
}
