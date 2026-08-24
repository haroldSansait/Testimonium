import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import Constants from "expo-constants";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import { AppHeader, Button, Card } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const SettingsScreen: React.FC = () => {
  const router = useRouter();
  const { profile, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const appVersion = Constants.expoConfig?.version || Constants.nativeAppVersion || "Unavailable";
  const nativeBuild =
    Constants.nativeBuildVersion ||
    Constants.expoConfig?.ios?.buildNumber ||
    (Constants.expoConfig?.android?.versionCode ? String(Constants.expoConfig.android.versionCode) : null);
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

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Settings"
        subtitle="Account, Privacy & Legal"
        onBack={handleBack}
      />

      <ScrollView contentContainerStyle={styles.content}>
        {/* Account Section */}
        <Text style={styles.sectionHeader}>Account</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate("/(app)/profile/edit")}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBox}>
              <Ionicons name="person-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Edit Profile</Text>
              <Text style={styles.menuSubtitle}>
                {profile?.fullName || "Update your name, contact and address"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Legal & Policies */}
        <Text style={styles.sectionHeader}>Legal & Compliance</Text>
        <Card style={styles.menuCard}>
          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemBorder]}
            onPress={() => handleNavigate("/(app)/profile/terms")}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBox}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Terms of Service</Text>
              <Text style={styles.menuSubtitle}>
                Sacramental record processing & scheduling terms
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => handleNavigate("/(app)/profile/privacy")}
            activeOpacity={0.7}
          >
            <View style={styles.menuIconBox}>
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.primary} />
            </View>
            <View style={styles.menuTextCol}>
              <Text style={styles.menuTitle}>Privacy Policy</Text>
              <Text style={styles.menuSubtitle}>
                Data privacy & ecclesiastical registry protection
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* App Information */}
        <Text style={styles.sectionHeader}>About</Text>
        <Card style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Application</Text>
            <Text style={styles.infoValue}>TESTIMONIUM Mobile</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Version</Text>
            <Text style={styles.infoValue}>{versionLabel}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Diocese</Text>
            <Text style={styles.infoValue}>Diocese of San Carlos</Text>
          </View>
          <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.infoLabel}>Platform</Text>
            <Text style={styles.infoValue}>Parishioner Portal</Text>
          </View>
        </Card>

        {/* Logout Section */}
        <View style={styles.logoutSection}>
          <Button
            title="Sign Out"
            variant="danger"
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
    paddingBottom: spacing.xxl,
  },
  sectionHeader: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    marginLeft: 4,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    padding: 0,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    gap: spacing.md,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  menuTextCol: {
    flex: 1,
  },
  menuTitle: {
    ...fontStyles.body,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  menuSubtitle: {
    ...fontStyles.caption,
    color: colors.textMuted,
    marginTop: 2,
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    padding: spacing.md,
    gap: spacing.xs,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  infoLabel: {
    ...fontStyles.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...fontStyles.bodySmall,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  logoutSection: {
    marginTop: spacing.xl,
  },
});
