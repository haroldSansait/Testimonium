import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { LoadingState } from '@/components/Screen';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { FeedbackProvider } from '@/providers/FeedbackProvider';
import { ProductIntroProvider, useProductIntro } from '@/providers/ProductIntroProvider';
import { getProtectedRouteGuards } from '@/services/auth/guards';
import { queryClient } from '@/services/queryClient';
import { useAndroidPush } from '@/features/notifications/useAndroidPush';

void SplashScreen.preventAutoHideAsync();

const Router = () => {
  const { state } = useAuth();
  const { introCompleted } = useProductIntro();
  useAndroidPush(introCompleted === true);

  const isResolving =
    introCompleted === null ||
    state === 'BOOTING' ||
    state === 'FIREBASE_USER_PENDING_BACKEND';

  useEffect(() => {
    if (!isResolving) void SplashScreen.hideAsync();
  }, [isResolving]);

  if (introCompleted === null || state === 'BOOTING') {
    return <LoadingState label={'Preparing TESTIMONIUM\u2026'} />;
  }

  const showIntro = introCompleted === false;
  const guards = getProtectedRouteGuards(state);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={showIntro}>
        <Stack.Screen name='(product-onboarding)' />
      </Stack.Protected>
      <Stack.Protected guard={!showIntro && guards.auth}>
        <Stack.Screen name='(auth)' />
      </Stack.Protected>
      <Stack.Protected guard={!showIntro && guards.onboarding}>
        <Stack.Screen name='(onboarding)' />
      </Stack.Protected>
      <Stack.Protected guard={!showIntro && guards.app}>
        <Stack.Screen name='(app)' />
      </Stack.Protected>
      <Stack.Screen name='+not-found' />
    </Stack>
  );
};

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ProductIntroProvider>
          <FeedbackProvider>
            <Router />
          </FeedbackProvider>
        </ProductIntroProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
