import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AuthScaffold } from "@/components/auth/AuthScaffold";
import { Button } from "@/components/ui/Button";
import { FormSection } from "@/components/ui/FormSection";
import { Divider } from "@/components/ui/Divider";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export default function ProfileCompletionScreen() {
  const { profile, isUpdatingProfile, updateProfile, logout } = useAuth();

  const initialFullName = profile?.fullName?.trim() || "";
  const nameParts = initialFullName ? initialFullName.split(/\s+/) : [];
  const initialFirst = nameParts[0] || "";
  const initialLast = nameParts.length > 1 ? nameParts.slice(1).join(" ") : "";

  const [firstName, setFirstName] = useState(initialFirst);
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState(initialLast);
  const [suffix, setSuffix] = useState("");
  const [contactNumber, setContactNumber] = useState(profile?.contactNumber || "");
  const [address, setAddress] = useState(profile?.address || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (isUpdatingProfile) return;

    const trimmedFirstName = firstName.trim();
    const trimmedLastName = lastName.trim();
    const trimmedContact = contactNumber.trim();

    if (!trimmedFirstName || !trimmedLastName) {
      setError("First Name and Last Name are required.");
      return;
    }

    if (!trimmedContact) {
      setError("Contact telephone or mobile number is required.");
      return;
    }

    setError(null);
    try {
      const updated = await updateProfile({
        firstName: trimmedFirstName,
        middleName: middleName.trim() || undefined,
        lastName: trimmedLastName,
        suffix: suffix.trim() || undefined,
        contactNumber: trimmedContact,
        address: address.trim() || undefined,
      });

      if (updated.needsProfileCompletion) {
        setError("Some required profile fields are still missing. Please verify all information.");
      }
    } catch (cause) {
      setError(
        isAppError(cause)
          ? cause.message
          : "Could not save profile details. Please try again."
      );
    }
  };

  return (
    <AuthScaffold
      compactHero
      title="Complete Your Profile"
      subtitle="Please provide your official contact details so our parish offices can process your sacramental requests and send notification updates."
    >
      <View style={styles.container}>
        {/* Error Notice */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={18}
              color={colors.danger}
              style={{ marginTop: 1 }}
            />
            <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
              {error}
            </Text>
          </View>
        )}

        {/* Section 1: Legal Name */}
        <FormSection title="Full Legal Name">
          <TextInput
            label="First Name *"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="e.g. Juan"
            autoCapitalize="words"
            editable={!isUpdatingProfile}
          />
          <TextInput
            label="Middle Name (Optional)"
            value={middleName}
            onChangeText={setMiddleName}
            placeholder="e.g. Santos"
            autoCapitalize="words"
            editable={!isUpdatingProfile}
          />
          <TextInput
            label="Last Name *"
            value={lastName}
            onChangeText={setLastName}
            placeholder="e.g. Dela Cruz"
            autoCapitalize="words"
            editable={!isUpdatingProfile}
          />
          <TextInput
            label="Suffix (Optional)"
            value={suffix}
            onChangeText={setSuffix}
            placeholder="e.g. Jr., III"
            autoCapitalize="words"
            editable={!isUpdatingProfile}
          />
        </FormSection>

        <Divider />

        {/* Section 2: Contact & Address */}
        <FormSection title="Contact & Address Details">
          <TextInput
            label="Contact Number *"
            value={contactNumber}
            onChangeText={setContactNumber}
            keyboardType="phone-pad"
            placeholder="e.g. 09123456789 or +639123456789"
            helperText="Used for official SMS notices and verification."
            editable={!isUpdatingProfile}
          />
          <TextInput
            label="Home / Permanent Address (Optional)"
            value={address}
            onChangeText={setAddress}
            placeholder="e.g. Barangay, Municipality/City, Province"
            autoCapitalize="words"
            editable={!isUpdatingProfile}
          />
        </FormSection>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={isUpdatingProfile ? "Saving Profile..." : "Save & Continue to App"}
            size="lg"
            loading={isUpdatingProfile}
            disabled={
              isUpdatingProfile ||
              !firstName.trim() ||
              !lastName.trim() ||
              !contactNumber.trim()
            }
            onPress={() => {
              void handleSubmit();
            }}
          />

          <Button
            title="Sign Out"
            variant="outline"
            size="lg"
            disabled={isUpdatingProfile}
            onPress={() => {
              void logout();
            }}
          />
        </View>
      </View>
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  errorText: {
    ...fontStyles.caption,
    color: colors.danger,
    lineHeight: 18,
    flex: 1,
  },
  actions: {
    gap: spacing.sm,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
});