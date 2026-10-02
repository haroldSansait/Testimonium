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
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import {
  AppHeader,
  Button,
  ListRow,
  PageSection,
  RecordSection,
  StatusLabel,
} from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { ID_TYPE_LABELS, REJECTION_REASON_MESSAGES } from "./types/governmentId";

export const ProfileScreen: React.FC = () => {
  const router = useRouter();
  const { contentBottomInset } = useAppLayoutMetrics();
  const { profile, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const isGovernmentIdExpired =
    !profile?.isGovernmentIdVerified &&
    profile?.governmentIdVerificationStatus === "VERIFIED";

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

  const initials = profile?.fullName
    ? profile.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((n) => n[0].toUpperCase())
        .join("")
    : "P";

  const accountFields = [
    ...(profile?.contactNumber
      ? [
          {
            label: "Contact Number",
            value: profile.contactNumber,
          },
        ]
      : []),
    ...(profile?.address
      ? [
          {
            label: "Residential Address",
            value: profile.address,
          },
        ]
      : []),
    {
      label: "Diocese",
      value: "Diocese of San Carlos",
    },
    {
      label: "Access Level",
      value: "Diocesan Parishioner",
    },
  ];

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
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
          </TouchableOpacity>
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: contentBottomInset("tab") },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* User Identity Header */}
        <View style={styles.identityCard}>
          <View style={styles.avatarMonogram}>
            <Text style={styles.avatarMonogramText} allowFontScaling>
              {initials}
            </Text>
          </View>

          <View style={styles.identityInfo}>
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

            <View style={styles.badgeRow}>
              <StatusLabel
                label={
                  profile?.role
                    ? profile.role.charAt(0) + profile.role.slice(1).toLowerCase()
                    : "Parishioner"
                }
                status="default"
                showDot={false}
              />
              <StatusLabel
                label={
                  profile?.status
                    ? profile.status.charAt(0) + profile.status.slice(1).toLowerCase()
                    : "Active"
                }
                status="APPROVED"
                showDot={true}
              />
            </View>
          </View>
        </View>

        {/* Government ID Verification Section */}
        <View style={styles.idVerificationCard}>
          <View style={styles.idCardHeader}>
            <View
              style={[
                styles.idCardIconWrap,
                profile?.isGovernmentIdVerified
                  ? styles.idCardIconWrapVerified
                  : profile?.governmentIdVerificationStatus === "REJECTED"
                  ? styles.idCardIconWrapRejected
                  : styles.idCardIconWrapPending,
              ]}
            >
              <Ionicons
                name={
                  profile?.isGovernmentIdVerified
                    ? "shield-checkmark"
                    : profile?.governmentIdVerificationStatus === "REJECTED"
                    ? "alert-circle"
                    : "shield-outline"
                }
                size={22}
                color={
                  profile?.isGovernmentIdVerified
                    ? "#059669"
                    : profile?.governmentIdVerificationStatus === "REJECTED"
                    ? "#DC2626"
                    : colors.primary
                }
              />
            </View>
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={styles.idCardTitle}>Government ID</Text>
                <StatusLabel
                  label={
                    profile?.isGovernmentIdVerified
                      ? "Verified"
                      : isGovernmentIdExpired
                      ? "Expired"
                      : profile?.governmentIdVerificationStatus === "REJECTED"
                      ? "Rejected"
                      : "Not Verified"
                  }
                  status={
                    profile?.isGovernmentIdVerified
                      ? "APPROVED"
                      : profile?.governmentIdVerificationStatus === "REJECTED"
                      ? "REJECTED"
                      : "default"
                  }
                  showDot={true}
                />
              </View>

              {profile?.isGovernmentIdVerified ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.idCardSubtitle}>
                    {profile.governmentIdType && ID_TYPE_LABELS[profile.governmentIdType]
                      ? ID_TYPE_LABELS[profile.governmentIdType]
                      : profile.governmentIdType || "Philippine Government ID"}
                  </Text>
                  {profile.governmentIdVerifiedAt ? (
                    <Text style={styles.idCardMeta}>
                      Verified on {new Date(profile.governmentIdVerifiedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                    </Text>
                  ) : null}
                  {profile.governmentIdExpiresAt ? (
                    <Text style={styles.idCardMeta}>
                      Valid until {new Date(profile.governmentIdExpiresAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                    </Text>
                  ) : null}
                </View>
              ) : isGovernmentIdExpired ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.idCardErrorText}>
                    Your previous Government ID verification has expired. Submit a current ID to verify again.
                  </Text>
                  <Button
                    title="Verify Current ID"
                    variant="primary"
                    size="sm"
                    onPress={() => handleNavigate("/(app)/profile/id-verification")}
                    style={{ marginTop: 8, alignSelf: "flex-start" }}
                  />
                </View>
              ) : profile?.governmentIdVerificationStatus === "REJECTED" ? (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.idCardErrorText}>
                    {profile.governmentIdRejectionReason && REJECTION_REASON_MESSAGES[profile.governmentIdRejectionReason]
                      ? REJECTION_REASON_MESSAGES[profile.governmentIdRejectionReason]
                      : profile.governmentIdRejectionReason || "Verification failed. Please retry with clearer photos."}
                  </Text>
                  <Button
                    title="Retry Verification"
                    variant="outline"
                    size="sm"
                    onPress={() => handleNavigate("/(app)/profile/id-verification")}
                    style={{ marginTop: 8, alignSelf: "flex-start" }}
                  />
                </View>
              ) : (
                <View style={{ marginTop: 4 }}>
                  <Text style={styles.idCardSubtitle}>
                    Verify your Philippine Government ID card to request documents and schedule parish appointments.
                  </Text>
                  <Button
                    title="Verify Government ID"
                    variant="primary"
                    size="sm"
                    onPress={() => handleNavigate("/(app)/profile/id-verification")}
                    style={{ marginTop: 8, alignSelf: "flex-start" }}
                  />
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Account Details Record Section */}
        <View style={styles.sectionWrap}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionHeaderTitle} allowFontScaling>
              Account Information
            </Text>
            <TouchableOpacity
              onPress={() => handleNavigate("/(app)/profile/edit")}
              activeOpacity={0.7}
              style={styles.editLinkBtn}
              accessibilityRole="button"
              accessibilityLabel="Edit profile details"
            >
              <Ionicons name="pencil-outline" size={13} color={colors.primary} />
              <Text style={styles.editLinkText} allowFontScaling>
                Edit
              </Text>
            </TouchableOpacity>
          </View>

          <RecordSection fields={accountFields} />
        </View>

        {/* App & Policies Section */}
        <PageSection title="App & Information" style={styles.sectionWrap}>
          <ListRow
            title="App Settings"
            subtitle="Notifications, legal & version details"
            leading={
              <Ionicons
                name="settings-outline"
                size={20}
                color={colors.primary}
              />
            }
            showChevron={true}
            onPress={() => handleNavigate("/(app)/profile/settings")}
          />
          <ListRow
            title="Help Center"
            subtitle="Guides for certificates, scheduling & Caloy"
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
            subtitle="Sacramental record & appointment terms"
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

        {/* Sign Out Section */}
        <View style={styles.logoutSection}>
          <Text style={styles.logoutNotice} allowFontScaling>
            Signing out will end your current session and clear local cached data securely.
          </Text>
          <Button
            title="Sign Out"
            variant="outline"
            size="lg"
            icon="log-out-outline"
            loading={loggingOut}
            onPress={handleLogout}
            accessibilityLabel="Sign out of TESTIMONIUM"
            accessibilityHint="Ends your session and returns to login"
          />
        </View>
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
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
  },
  identityCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.md,
  },
  avatarMonogram: {
    width: 52,
    height: 52,
    borderRadius: radii.xs,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarMonogramText: {
    ...fontStyles.titleMedium,
    color: colors.primary,
    fontWeight: "700",
    fontSize: 20,
  },
  identityInfo: {
    flex: 1,
  },
  userName: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 17,
  },
  userEmail: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    marginTop: 1,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  sectionWrap: {
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  sectionHeaderTitle: {
    ...fontStyles.caption,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  editLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  editLinkText: {
    ...fontStyles.captionMedium,
    fontWeight: "600",
    color: colors.primary,
  },
  logoutSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
  },
  logoutNotice: {
    ...fontStyles.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: "center",
    lineHeight: 18,
  },
  idVerificationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: radii.xl,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  idCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  idCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  idCardIconWrapVerified: {
    backgroundColor: "#ECFDF5",
  },
  idCardIconWrapRejected: {
    backgroundColor: "#FEF2F2",
  },
  idCardIconWrapPending: {
    backgroundColor: colors.primarySoft,
  },
  idCardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  idCardSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  idCardMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  idCardErrorText: {
    fontSize: 13,
    color: "#DC2626",
    lineHeight: 18,
  },
});
