import { Redirect } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";
export default function OnboardingIndex() {
  const { state } = useAuth();
  if (state === "EMAIL_VERIFICATION_REQUIRED") return <Redirect href="/(onboarding)/verify-email" />;
  if (state === "LEGAL_REQUIRED") return <Redirect href="/(onboarding)/legal" />;
  return <Redirect href="/(onboarding)/profile-completion" />;
}