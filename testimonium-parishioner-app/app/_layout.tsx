import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { LoadingState } from '@/components/Screen';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { getProtectedRouteGuards } from '@/services/auth/guards';
import { queryClient } from '@/services/queryClient';

void SplashScreen.preventAutoHideAsync();

const Router = () => {
  const { state } = useAuth();
  const isResolving = state === 'BOOTING' || state === 'FIREBASE_USER_PENDING_BACKEND';
  useEffect(() => { if (!isResolving) void SplashScreen.hideAsync(); }, [isResolving]);
  if (state === 'BOOTING') return <LoadingState label={'Preparing TESTIMONIUM\u2026'} />;
  const guards = getProtectedRouteGuards(state);
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={guards.auth}><Stack.Screen name='(auth)' /></Stack.Protected>
    <Stack.Protected guard={guards.onboarding}><Stack.Screen name='(onboarding)' /></Stack.Protected>
    <Stack.Protected guard={guards.app}><Stack.Screen name='(app)' /></Stack.Protected>
    <Stack.Screen name='+not-found' />
  </Stack>;
};

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><AuthProvider><Router /></AuthProvider></QueryClientProvider>;
}
