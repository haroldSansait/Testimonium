import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "@/components/Screen";
import { AppHeader, Button, Card, TextInput } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const EditProfileScreen: React.FC = () => {
  const router = useRouter();
  const { profile, updateProfile, isUpdatingProfile } = useAuth();

  const [fullName, setFullName] = useState<string>(profile?.fullName || "");
  const [contactNumber, setContactNumber] = useState<string>(
    profile?.contactNumber || ""
  );
  const [address, setAddress] = useState<string>(profile?.address || "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(profile)" as any);
    }
  };

  const handleSave = async () => {
    const trimmedName = fullName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setErrorMessage("Full name is required (at least 2 characters).");
      return;
    }

    setErrorMessage(null);

    try {
      await updateProfile({
        fullName: trimmedName,
        contactNumber: contactNumber.trim() || undefined,
        address: address.trim() || undefined,
      });

      Alert.alert(
        "Profile Updated",
        "Your profile information has been saved successfully.",
        [
          {
            text: "OK",
            onPress: () => {
              handleBack();
            },
          },
        ]
      );
    } catch (err: any) {
      const msg =
        err?.message || "Failed to update profile. Please try again.";
      setErrorMessage(msg);
      Alert.alert("Update Failed", msg);
    }
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Edit Profile"
        subtitle="Update Account Details"
        onBack={handleBack}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <Card style={styles.formCard}>
            <Text style={styles.sectionHeader}>Personal Information</Text>

            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyLabel}>Email Address</Text>
              <Text style={styles.readOnlyValue}>{profile?.email}</Text>
              <Text style={styles.readOnlyHint}>
                Email address is managed via your sign-in account.
              </Text>
            </View>

            <TextInput
              label="Full Name *"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                setErrorMessage(null);
              }}
              placeholder="e.g. Maria Santos Dela Cruz"
              autoCapitalize="words"
              maxLength={100}
            />

            <TextInput
              label="Contact Number"
              value={contactNumber}
              onChangeText={(text) => {
                setContactNumber(text);
                setErrorMessage(null);
              }}
              placeholder="e.g. 09171234567"
              keyboardType="phone-pad"
              maxLength={20}
            />

            <TextInput
              label="Home / Residential Address"
              value={address}
              onChangeText={(text) => {
                setAddress(text);
                setErrorMessage(null);
              }}
              placeholder="e.g. Brgy. 1, San Carlos City, Negros Occidental"
              multiline
              numberOfLines={2}
              maxLength={200}
            />

            {errorMessage && (
              <Text style={styles.errorBanner}>{errorMessage}</Text>
            )}

            <Button
              title="Save Changes"
              variant="primary"
              size="lg"
              loading={isUpdatingProfile}
              disabled={isUpdatingProfile}
              onPress={handleSave}
              style={styles.saveButton}
              accessibilityLabel="Save profile changes"
            />
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  readOnlyRow: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: spacing.xs,
  },
  readOnlyLabel: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  readOnlyValue: {
    ...fontStyles.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  readOnlyHint: {
    ...fontStyles.caption,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBanner: {
    ...fontStyles.caption,
    color: colors.danger,
    backgroundColor: "#FEF2F2",
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  saveButton: {
    marginTop: spacing.sm,
  },
});
