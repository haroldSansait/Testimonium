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
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  AppHeader,
  Badge,
  Button,
  Card,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const { profile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Sign Out",
      "Are you sure you want to sign out of TESTIMONIUM? Your local session and cached data will be cleared.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleNavigate = (path: string) => {
    router.push(path as any);
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Parishioner Account"
        subtitle="Identity & Settings"
        rightAction={
          <TouchableOpacity
            style={styles.settingsIconBtn}
            onPress={() => handleNavigate("/(app)/profile/settings")}
            accessibilityLabel="Settings"
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* User Identity Card */}
        <Card style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatarCircle}>
              <Ionicons
                name="person-outline"
                size={36}
                color={colors.primary}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
            </View>
            <View style={styles.avatarTextContainer}>
              <Text
                style={styles.userName}
                accessibilityRole="header"
                allowFontScaling
              >
                {profile?.fullName || "Parishioner"}
              </Text>
              <Text style={styles.userEmail} allowFontScaling>
                {profile?.email}
              </Text>
              <View style={styles.roleBadgeRow}>
                <Badge
                  label={
                    profile?.role
                      ? profile.role.charAt(0) + profile.role.slice(1).toLowerCase()
                      : "Parishioner"
                  }
                  variant="primary"
                />
                <Badge
                  label={
                    profile?.status
                      ? profile.status.charAt(0) + profile.status.slice(1).toLowerCase()
                      : "Active"
                  }
                  variant="success"
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Account Details */}
        <Card style={styles.detailsCard}>
          <View style={styles.cardHeaderWithAction}>
            <Text style={styles.cardSectionTitle} allowFontScaling>
              Account Information
            </Text>
            <TouchableOpacity
              onPress={() => handleNavigate("/(app)/profile/edit")}
              activeOpacity={0.7}
              style={styles.editLinkBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit profile details"
            >
              <Ionicons name="pencil" size={13} color={colors.primary} />
              <Text style={styles.editLinkText} allowFontScaling>Edit</Text>
            </TouchableOpacity>
          </View>

          {profile?.contactNumber ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel} allowFontScaling>
                Contact Number
              </Text>
              <Text style={styles.detailValue} allowFontScaling>
                {profile.contactNumber}
              </Text>
            </View>
          ) : null}

          {profile?.address ? (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel} allowFontScaling>
                Address
              </Text>
              <Text style={styles.detailValue} allowFontScaling>
                {profile.address}
              </Text>
            </View>
          ) : null}

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel} allowFontScaling>
              Diocese
            </Text>
            <Text style={styles.detailValue} allowFontScaling>
              Diocese of San Carlos
            </Text>
          </View>

          <View style={[styles.detailRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.detailLabel} allowFontScaling>
              Access Level
            </Text>
            <Text style={styles.detailValue} allowFontScaling>
              Diocesan Parishioner
            </Text>
          </View>
        </Card>

        {/* Quick Links / Settings Card */}
        <Card style={styles.linksCard}>
          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => handleNavigate("/(app)/profile/settings")}
            activeOpacity={0.7}
          >
            <Ionicons name="settings-outline" size={18} color={colors.primary} />
            <Text style={styles.linkText}>App Settings & Information</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => handleNavigate("/(app)/profile/terms")}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text-outline" size={18} color={colors.primary} />
            <Text style={styles.linkText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.linkRow, { borderBottomWidth: 0 }]}
            onPress={() => handleNavigate("/(app)/profile/privacy")}
            activeOpacity={0.7}
          >
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
            <Text style={styles.linkText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </Card>

        {/* Sign Out Card */}
        <Card style={styles.actionsCard}>
          <Text style={styles.logoutNotice} allowFontScaling>
            Signing out will end your current session and clear local cached data securely.
          </Text>
          <Button
            title="Sign Out"
            variant="danger"
            size="lg"
            icon="log-out-outline"
            loading={loggingOut}
            onPress={handleLogout}
            accessibilityLabel="Sign out of TESTIMONIUM"
            accessibilityHint="Ends your session and returns to login"
          />
        </Card>
      </ScrollView>
    </Screen>
  );
};

const styles = StyleSheet.create({
  screen: {
    padding: 0,
    backgroundColor: colors.background,
  },
  settingsIconBtn: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  profileCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  avatarContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarCircle: {
    width: 64,
    height: 64,
    borderRadius: radii.pill,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
    alignItems: "center",
    marginRight: spacing.md,
  },
  avatarTextContainer: {
    flex: 1,
  },
  userName: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    fontWeight: "700",
  },
  userEmail: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xxs,
  },
  roleBadgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  detailsCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  cardHeaderWithAction: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  cardSectionTitle: {
    ...fontStyles.subheading,
    color: colors.textPrimary,
    fontWeight: "700",
    flex: 1,
    paddingRight: spacing.sm,
  },
  editLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    flexShrink: 0,
  },
  editLinkText: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.primary,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  detailLabel: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
  },
  detailValue: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontWeight: "600",
  },
  linksCard: {
    marginBottom: spacing.md,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
    padding: 0,
    overflow: "hidden",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  linkText: {
    ...fontStyles.body,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
  },
  actionsCard: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderColor: colors.cardBorder,
  },
  logoutNotice: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
});
