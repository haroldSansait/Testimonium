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

export const checkGovernmentIdRequirement = (
  profile: { needsProfileCompletion?: boolean | null; isGovernmentIdVerified?: boolean | null } | null | undefined,
  router: { push: (href: any) => void },
  onAllowed: () => void
): boolean => {
  if (profile?.needsProfileCompletion) {
    return checkProfileRequirement(profile, router, onAllowed);
  }

  if (!profile?.isGovernmentIdVerified) {
    Alert.alert(
      "Government ID Verification Required",
      "Please verify your Philippine government-issued ID to access document and schedule requests.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Verify ID",
          onPress: () => router.push("/(app)/profile/id-verification" as any),
        },
      ]
    );
    return false;
  }

  onAllowed();
  return true;
};

export const useRequireGovernmentId = () => {
  const { profile } = useAuth();
  const router = useRouter();
  const isGovernmentIdVerified = Boolean(profile?.isGovernmentIdVerified);

  const requireGovernmentId = (onAllowed: () => void): boolean => {
    return checkGovernmentIdRequirement(profile, router, onAllowed);
  };

  return {
    isGovernmentIdVerified,
    requireGovernmentId,
  };
};
