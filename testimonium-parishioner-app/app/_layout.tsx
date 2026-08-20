import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { LoadingState } from "@/components/Screen";
import { AuthProvider, useAuth } from "@/providers/AuthProvider";
import { queryClient } from "@/services/queryClient";

void SplashScreen.preventAutoHideAsync();

const Router = () => {
  const { state } = useAuth();
  const isResolving = state === "BOOTING" || state === "FIREBASE_USER_PENDING_BACKEND";
  useEffect(() => { if (!isResolving) void SplashScreen.hideAsync(); }, [isResolving]);
  if (isResolving) return <LoadingState label="Preparing TESTIMONIUM…" />;
  const authGuard = state === "NO_FIREBASE_USER" || state === "SESSION_ERROR";
  const onboardingGuard = ["EMAIL_VERIFICATION_REQUIRED", "LEGAL_REQUIRED", "PROFILE_COMPLETION_REQUIRED"].includes(state);
  return <Stack screenOptions={{ headerShown: false }}>
    <Stack.Protected guard={authGuard}><Stack.Screen name="(auth)" /></Stack.Protected>
    <Stack.Protected guard={onboardingGuard}><Stack.Screen name="(onboarding)" /></Stack.Protected>
    <Stack.Protected guard={state === "AUTHENTICATED_READY"}><Stack.Screen name="(app)" /></Stack.Protected>
    <Stack.Screen name="+not-found" />
  </Stack>;
};

export default function RootLayout() {
  return <QueryClientProvider client={queryClient}><AuthProvider><Router /></AuthProvider></QueryClientProvider>;
}