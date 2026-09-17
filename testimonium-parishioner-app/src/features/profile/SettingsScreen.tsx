import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import {
  AppHeader,
  Button,
  ListRow,
  PageSection,
  RecordSection,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing } from "@/theme/tokens";

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();
  const { profile, logout, refreshProfile, updateProfile } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingEmailPreference, setIsSavingEmailPreference] = useState(false);
  const [emailPreferenceOverride, setEmailPreferenceOverride] = useState<
    boolean | null
  >(null);
  const emailNotificationsEnabled =
    emailPreferenceOverride ?? profile?.emailNotificationsEnabled ?? true;

  const appVersion =
    Constants.expoConfig?.version || Constants.nativeAppVersion || "1.0.0";
  const nativeBuild =
    Constants.nativeBuildVersion ||
    (Constants.expoConfig?.android?.versionCode
      ? String(Constants.expoConfig.android.versionCode)
      : null);
  const versionLabel = nativeBuild ? `${appVersion} (Build ${nativeBuild})` : appVersion;

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(app)/(tabs)/(profile)" as any);
    }
  };

  const handleNavigate = (path: string) => {
    router.push(path as any);
  };

  const handleReplayIntro = async () => {
    Alert.alert(
      "Replay Welcome Tour",
      "Would you like to replay the TESTIMONIUM welcome tour?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start Tour",
          onPress: () => {
            router.push({
              pathname: "/(product-onboarding)" as any,
              params: { preview: "true" },
            });
          },
        },
      ]
    );
  };

  const handleEmailPreferenceChange = async (nextValue: boolean) => {
    if (isSavingEmailPreference) return;
    const previousValue = emailNotificationsEnabled;
    setEmailPreferenceOverride(nextValue);
    setIsSavingEmailPreference(true);

    try {
      await updateProfile({
        emailNotificationsEnabled: nextValue,
      });
      setEmailPreferenceOverride(null);
    } catch (error: any) {
      setEmailPreferenceOverride(previousValue);
      try {
        await refreshProfile();
        setEmailPreferenceOverride(null);
      } catch {
        // Preserve the known pre-save value if the authoritative refetch also fails.
      }
      Alert.alert(
        "Preference Not Saved",
        error?.message ||
          "Email notification preference could not be saved. Please try again."
      );
    } finally {
      setIsSavingEmailPreference(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of TESTIMONIUM? Your local cache will be cleared securely.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setIsLoggingOut(true);
            try {
              await logout();
            } finally {
              setIsLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const aboutFields = [
    { label: "Application", value: "TESTIMONIUM Mobile" },
    { label: "Version", value: versionLabel },
    { label: "Diocese", value: "Diocese of San Carlos" },
    { label: "Platform", value: "Parishioner Portal" },
  ];

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Settings"
        subtitle="Account, Privacy & Legal"
        onBack={handleBack}
      />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: contentBottomInset() },
        ]}
      >
        {/* Account Section */}
        <PageSection title="Account & Profile" style={styles.sectionWrap}>
          <ListRow
            title="Edit Profile"
            subtitle={profile?.fullName || "Update your name, contact and address"}
            leading={
              <Ionicons
                name="person-outline"
                size={20}
                color={colors.primary}
              />
            }
            showChevron={true}
            onPress={() => handleNavigate("/(app)/profile/edit")}
          />
        </PageSection>

        {/* Preferences Section */}
        <PageSection title="Preferences & Tour" style={styles.sectionWrap}>
          <ListRow
            title="Email Notifications"
            subtitle="Updates for certificates, schedules and payments"
            leading={
              <Ionicons
                name="mail-outline"
                size={20}
                color={colors.primary}
              />
            }
            trailing={
              <Switch
                value={emailNotificationsEnabled}
                onValueChange={(value) => {
                  void handleEmailPreferenceChange(value);
                }}
                disabled={isSavingEmailPreference}
                trackColor={{ false: colors.borderLight, true: colors.primaryLight }}
                thumbColor={emailNotificationsEnabled ? colors.primary : colors.surface}
                accessibilityLabel="Email notifications"
                accessibilityState={{
                  checked: emailNotificationsEnabled,
                  disabled: isSavingEmailPreference,
                }}
              />
            }
          />
          <ListRow
            title="Replay Welcome Tour"
            subtitle="Review TESTIMONIUM features and guides"
            leading={
              <Ionicons
                name="sparkles-outline"
                size={20}
                color={colors.primary}
              />
            }
            showChevron={true}
            showDivider={false}
            onPress={handleReplayIntro}
          />
        </PageSection>

        {/* Legal & Compliance Section */}
        <PageSection title="Legal & Compliance" style={styles.sectionWrap}>
          <ListRow
            title="Help Center"
            subtitle="Requests, scheduling, payments and events"
            leading={
              <Ionicons
                name="help-circle-outline"
                size={20}
                color={colors.primary}
              />
            }
            showChevron={true}
            onPress={() => handleNavigate("/(app)/profile/help")}
          />
          <ListRow
            title="Terms of Service"
            subtitle="Sacramental record processing & scheduling terms"
            leading={
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.primary}
              />
            }
            showChevron={true}
            onPress={() => handleNavigate("/(app)/profile/terms")}
          />
          <ListRow
            title="Privacy Policy"
            subtitle="Data privacy & ecclesiastical registry protection"
            leading={
              <Ionicons
                name="shield-checkmark-outline"
                size={20}
                color={colors.primary}
              />
            }
            showChevron={true}
            showDivider={false}
            onPress={() => handleNavigate("/(app)/profile/privacy")}
          />
        </PageSection>

        {/* Application Information Record Section */}
        <View style={styles.sectionWrap}>
          <RecordSection title="About TESTIMONIUM" fields={aboutFields} />
        </View>

        {/* Sign Out Section */}
        <View style={styles.logoutSection}>
          <Button
            title="Sign Out"
            variant="outline"
            size="lg"
            icon="log-out-outline"
            loading={isLoggingOut}
            disabled={isLoggingOut}
            onPress={handleLogout}
            accessibilityLabel="Sign out of TESTIMONIUM"
          />
        </View>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  sectionWrap: {
    marginBottom: spacing.md,
  },
  logoutSection: {
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
});
