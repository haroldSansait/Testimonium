import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, radii, spacing, typography } from "@/theme/tokens";

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
    <Screen scrollable style={styles.screen}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>ACCOUNT ONBOARDING</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Complete Your Profile
          </Text>
          <Text style={styles.copy} allowFontScaling>
            Please provide your official contact details so our parish secretaries can process your sacramental requests and notify you of status updates.
          </Text>
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionHeader} allowFontScaling>
            Full Legal Name
          </Text>
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
        </View>

        <View style={styles.formSection}>
          <Text style={styles.sectionHeader} allowFontScaling>
            Contact & Address Details
          </Text>
          <TextInput
            label="Contact Number *"
            value={contactNumber}
            onChangeText={setContactNumber}
            keyboardType="phone-pad"
            placeholder="e.g. 09123456789 or +639123456789"
            helperText="Used for official SMS and certificate verification notices."
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
        </View>

        {error && (
          <View style={styles.errorContainer}>
            <Text accessibilityRole="alert" style={styles.errorText} allowFontScaling>
              {error}
            </Text>
          </View>
        )}

        <View style={styles.actions}>
          <Button
            title={isUpdatingProfile ? "Saving Profile..." : "Save & Continue to App"}
            loading={isUpdatingProfile}
            disabled={isUpdatingProfile || !firstName.trim() || !lastName.trim() || !contactNumber.trim()}
            onPress={() => {
              void handleSubmit();
            }}
          />

          <Button
            title="Sign Out"
            variant="outline"
            disabled={isUpdatingProfile}
            onPress={() => {
              void logout();
            }}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    justifyContent: "center",
  },
  content: {
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  header: {
    gap: spacing.xs,
  },
  badgeContainer: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
  },
  badgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  title: {
    color: colors.primary,
    fontSize: typography.title,
    fontWeight: "700",
  },
  copy: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 22,
  },
  formSection: {
    gap: spacing.sm,
  },
  sectionHeader: {
    fontSize: typography.caption,
    fontWeight: "700",
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  errorContainer: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FCA5A5",
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  errorText: {
    color: colors.danger,
    fontSize: typography.caption,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
});