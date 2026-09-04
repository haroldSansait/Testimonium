import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/providers/AuthProvider";

export const checkProfileRequirement = (
  profile: { needsProfileCompletion?: boolean | null } | null | undefined,
  router: { push: (href: any) => void },
  onAllowed: () => void
): boolean => {
  const isProfileIncomplete = Boolean(profile?.needsProfileCompletion);
  if (isProfileIncomplete) {
    Alert.alert(
      "Profile Completion Required",
      "Complete your profile to access document and schedule requests.",
      [
        { text: "Browse App", style: "cancel" },
        {
          text: "Complete Profile",
          onPress: () => router.push("/(app)/(tabs)/profile" as any),
        },
      ]
    );
    return false;
  }
  onAllowed();
  return true;
};

export const useRequireCompleteProfile = () => {
  const { profile } = useAuth();
  const router = useRouter();
  const isProfileIncomplete = Boolean(profile?.needsProfileCompletion);

  const requireCompleteProfile = (onAllowed: () => void): boolean => {
    return checkProfileRequirement(profile, router, onAllowed);
  };

  return {
    isProfileIncomplete,
    requireCompleteProfile,
  };
};
