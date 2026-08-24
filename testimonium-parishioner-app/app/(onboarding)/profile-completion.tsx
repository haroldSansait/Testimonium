import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
    <Screen scrollable style={styles.screen}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.dioceseBadge}>
            <Text style={styles.dioceseBadgeText}>PROFILE SETUP</Text>
          </View>
          <Text style={styles.title} allowFontScaling>
            Complete Your Profile
          </Text>
          <Text style={styles.copy} allowFontScaling>
            Please provide your official contact details so our parish offices can process your sacramental requests and send notification updates.
          </Text>
        </View>

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

        {/* Full Legal Name Card */}
        <Card style={styles.formCard}>
          <Text style={styles.cardHeaderTitle} allowFontScaling>
            Full Legal Name
          </Text>
          <View style={styles.fields}>
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
        </Card>

        {/* Contact & Address Card */}
        <Card style={styles.formCard}>
          <Text style={styles.cardHeaderTitle} allowFontScaling>
            Contact & Address Details
          </Text>
          <View style={styles.fields}>
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
          </View>
        </Card>

        {/* Actions */}
        <View style={styles.actions}>
          <Button
            title={isUpdatingProfile ? "Saving Profile..." : "Save & Continue to App"}
            size="lg"
            loading={isUpdatingProfile}
            disabled={isUpdatingProfile || !firstName.trim() || !lastName.trim() || !contactNumber.trim()}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: colors.background,
  },
  container: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  header: {
    marginBottom: spacing.lg,
  },
  dioceseBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radii.sm,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary + "20",
  },
  dioceseBadgeText: {
    ...fontStyles.meta,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  title: {
    ...fontStyles.title,
    color: colors.textPrimary,
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
  },
  copy: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  formCard: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardHeaderTitle: {
    ...fontStyles.captionBold,
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  fields: {
    gap: spacing.md,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerBorder,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
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
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
});