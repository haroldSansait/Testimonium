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
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { AppHeader, Button, TextInput } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import {
  GoogleLegalNameConfirmationCard,
  StructuredLegalNameEditor,
} from "./components/GoogleLegalNameConfirmationCard";
import type { UpdateProfilePayload } from "@/types/auth";

export const EditProfileScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();
  const { profile, updateProfile, isUpdatingProfile } = useAuth();

  const isLegalNameLocked = profile?.governmentIdVerificationStatus === "VERIFIED";
  const needsLegalNameConfirmation = Boolean(
    profile?.needsLegalNameConfirmation && !isLegalNameLocked
  );

  const [contactNumber, setContactNumber] = useState<string>(
    profile?.contactNumber || ""
  );
  const [address, setAddress] = useState<string>(profile?.address || "");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [justConfirmedLegalName, setJustConfirmedLegalName] = useState(false);
  const [isEditingFullName, setIsEditingFullName] = useState(false);

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(profile)" as any);
    }
  };

  const handleSaveLegalName = async (payload: UpdateProfilePayload) => {
    const updated = await updateProfile(payload);
    if (!updated || updated.needsLegalNameConfirmation) {
      throw new Error("Your legal name has not been confirmed. Please try again.");
    }
    setJustConfirmedLegalName(true);
  };

  const handleSaveStructuredFullName = async (payload: UpdateProfilePayload) => {
    await updateProfile(payload);
    setIsEditingFullName(false);
    Alert.alert("Full Name Updated", "Your legal name has been updated successfully.");
  };

  const handleSave = async () => {
    setErrorMessage(null);

    try {
      const payload: UpdateProfilePayload = {
        contactNumber: contactNumber.trim() || undefined,
        address: address.trim() || undefined,
      };

      await updateProfile(payload);

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
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: contentBottomInset() },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.formContainer}>
            {needsLegalNameConfirmation && (
              <GoogleLegalNameConfirmationCard
                displayedFullName={profile?.fullName}
                isUpdating={isUpdatingProfile}
                onSaveLegalName={handleSaveLegalName}
              />
            )}

            {justConfirmedLegalName && !profile?.isGovernmentIdVerified && (
              <View style={styles.postConfirmCard}>
                <Text style={styles.postConfirmText} allowFontScaling>
                  Your legal name has been saved successfully. Please verify your Government ID to confirm your identity and access document requests.
                </Text>
                <Button
                  title="Verify Government ID Now"
                  variant="primary"
                  size="sm"
                  onPress={() => router.push("/(app)/profile/id-verification" as any)}
                  style={{ alignSelf: "flex-start" }}
                />
              </View>
            )}

            <Text style={styles.sectionHeader} allowFontScaling>
              Personal Information
            </Text>

            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyLabel} allowFontScaling>
                Email Address
              </Text>
              <Text style={styles.readOnlyValue} allowFontScaling>
                {profile?.email}
              </Text>
              <Text style={styles.readOnlyHint} allowFontScaling>
                Email address is managed via your sign-in account.
              </Text>
            </View>

            <View style={styles.readOnlyRow}>
              <Text style={styles.readOnlyLabel} allowFontScaling>
                Full Name
              </Text>
              <Text style={styles.readOnlyValue} allowFontScaling>
                {profile?.fullName || ""}
              </Text>
              {isLegalNameLocked && profile?.firstName && profile?.lastName && (
                <Text style={styles.readOnlyHint} allowFontScaling>
                  {[
                    `First: ${profile.firstName}`,
                    profile.middleName ? `Middle: ${profile.middleName}` : null,
                    `Last: ${profile.lastName}`,
                    profile.suffix ? `Suffix: ${profile.suffix}` : null,
                  ]
                    .filter(Boolean)
                    .join(" • ")}
                </Text>
              )}
              <Text style={styles.readOnlyHint} allowFontScaling>
                {isLegalNameLocked
                  ? "Your legal name is locked after Government ID verification."
                  : needsLegalNameConfirmation
                  ? "Confirm or correct your legal name above."
                  : "Full Name is read-only. Use Change Full Name to update your legal name."}
              </Text>
              {!isLegalNameLocked && !needsLegalNameConfirmation && !isEditingFullName && (
                <Button
                  title="Change Full Name"
                  variant="outline"
                  size="sm"
                  onPress={() => setIsEditingFullName(true)}
                  disabled={isUpdatingProfile}
                  style={{ marginTop: spacing.xs, alignSelf: "flex-start" }}
                />
              )}
            </View>

            {!isLegalNameLocked && !needsLegalNameConfirmation && isEditingFullName && (
              <StructuredLegalNameEditor
                initialFirstName={profile?.firstName}
                initialMiddleName={profile?.middleName}
                initialLastName={profile?.lastName}
                initialSuffix={profile?.suffix}
                isUpdating={isUpdatingProfile}
                onSave={handleSaveStructuredFullName}
                onCancel={() => setIsEditingFullName(false)}
              />
            )}

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
              <Text style={styles.errorBanner} allowFontScaling>
                {errorMessage}
              </Text>
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
          </View>
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
    padding: spacing.md,
  },
  formContainer: {
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    padding: spacing.md,
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
    fontWeight: "600",
    textTransform: "uppercase",
  },
  readOnlyValue: {
    ...fontStyles.body,
    fontWeight: "600",
    color: colors.textPrimary,
    marginTop: 2,
  },
  readOnlyHint: {
    ...fontStyles.caption,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  errorBanner: {
    ...fontStyles.caption,
    color: colors.danger,
    backgroundColor: colors.dangerSoft,
    padding: spacing.sm,
    borderRadius: radii.xs,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  saveButton: {
    marginTop: spacing.sm,
  },
  postConfirmCard: {
    backgroundColor: "#ECFDF5",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "#A7F3D0",
    padding: spacing.md,
    gap: spacing.sm,
  },
  postConfirmText: {
    ...fontStyles.bodySmall,
    color: "#064E3B",
    lineHeight: 19,
  },
});
