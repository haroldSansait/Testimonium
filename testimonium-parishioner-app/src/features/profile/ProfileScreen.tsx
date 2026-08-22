import React, { useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "@/components/Screen";
import {
  AppHeader,
  Badge,
  Button,
  Card,
  SectionHeader,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export const ProfileScreen: React.FC = () => {
  const { profile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <Screen safeArea={true} style={styles.screen}>
      <AppHeader
        title="Parishioner Account"
        subtitle="Identity & Session"
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
          <SectionHeader title="Account Information" />

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

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel} allowFontScaling>
              Diocese
            </Text>
            <Text style={styles.detailValue} allowFontScaling>
              Diocese of San Carlos
            </Text>
          </View>

          <View style={styles.detailRow}>
            <Text style={styles.detailLabel} allowFontScaling>
              Access Level
            </Text>
            <Text style={styles.detailValue} allowFontScaling>
              Diocesan Parishioner
            </Text>
          </View>
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
            onPress={() => {
              void handleLogout();
            }}
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
    fontWeight: "500",
  },
  actionsCard: {
    marginTop: spacing.sm,
    backgroundColor: colors.surface,
  },
  logoutNotice: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    textAlign: "center",
  },
});
