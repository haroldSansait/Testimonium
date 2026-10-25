import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, IconButton, StatusLabel } from "@/components/ui";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { useRequireCompleteProfile } from "@/hooks/useRequireCompleteProfile";
import { getEffectiveOfferedDocuments } from "@/features/requests/presentation";
import { colors, fontStyles, radii, spacing, shadows } from "@/theme/tokens";
import { useParishDetail } from "../api";
import type { ParishDto } from "../types";
import {
  buildEmailUrl,
  buildMapUrl,
  buildPhoneUrl,
  formatOfficeHours,
  openExternalUrl,
} from "../utils";

export interface ParishInfoSheetProps {
  parish: ParishDto | null;
  visible: boolean;
  onClose: () => void;
}

const ANIMATION_DURATION = 260;
const DISMISS_DRAG_THRESHOLD = 70;

export const ParishInfoSheet: React.FC<ParishInfoSheetProps> = ({
  parish,
  visible,
  onClose,
}) => {
  const router = useRouter();
  const { height, insets, contentBottomInset } = useAppLayoutMetrics();
  const { requireCompleteProfile } = useRequireCompleteProfile();

  const [failedImageId, setFailedImageId] = useState<string | null>(null);
  const [reduceMotion, setReduceMotion] = useState(false);

  // Animated values for entrance & interactive dragging (useState to satisfy React 19 compiler)
  const [translateY] = useState(() => new Animated.Value(height));
  const [opacity] = useState(() => new Animated.Value(0));

  // Fetch full parish detail if available, keyed strictly to selected parish
  const { data: detailData } = useParishDetail(
    visible && parish?.id ? parish.id : undefined
  );

  // Merge list DTO with detail DTO only when IDs match to prevent cross-parish data leaks
  const effectiveParish = useMemo<ParishDto | null>(() => {
    if (!parish) return null;
    if (detailData && String(detailData.id) === String(parish.id)) {
      return {
        ...parish,
        ...detailData,
      };
    }
    return parish;
  }, [parish, detailData]);

  // Check reduced motion setting
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  // Smooth dismiss animation
  const handleDismiss = useCallback(() => {
    const duration = reduceMotion ? 50 : ANIMATION_DURATION;

    Animated.parallel([
      Animated.timing(translateY, {
        toValue: height * 0.9,
        duration,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  }, [height, reduceMotion, translateY, opacity, onClose]);

  // Open animation when visible becomes true
  useEffect(() => {
    if (visible && parish) {
      const duration = reduceMotion ? 50 : ANIMATION_DURATION;

      translateY.setValue(height * 0.85);
      opacity.setValue(0);

      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, parish, height, reduceMotion, translateY, opacity]);

  // Android hardware back handler
  useEffect(() => {
    if (!visible) return;

    const onBackPress = () => {
      handleDismiss();
      return true;
    };

    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress
    );
    return () => backHandler.remove();
  }, [visible, handleDismiss]);

  // PanResponder for handle/header swipe-down dismissal
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Only respond to predominantly downward vertical gestures
          return gestureState.dy > 5 && Math.abs(gestureState.dy) > Math.abs(gestureState.dx);
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            translateY.setValue(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dy > DISMISS_DRAG_THRESHOLD || gestureState.vy > 0.5) {
            handleDismiss();
          } else {
            Animated.spring(translateY, {
              toValue: 0,
              damping: 24,
              stiffness: 280,
              useNativeDriver: true,
            }).start();
          }
        },
      }),
    [handleDismiss, translateY]
  );

  if (!visible || !effectiveParish) {
    return null;
  }

  const p = effectiveParish;
  const hasCoverImage = Boolean(
    failedImageId !== p.id && p.coverImage && p.coverImage.startsWith("http")
  );

  const phoneUrl = buildPhoneUrl(p.contactNumber);
  const emailUrl = buildEmailUrl(p.email);
  const mapUrl = buildMapUrl({
    latitude: p.latitude,
    longitude: p.longitude,
    address: p.address,
    name: p.name,
  });

  const officeHoursRows = formatOfficeHours(p.officeHours);
  const locationLabel = [p.municipalityCity, p.province].filter(Boolean).join(", ");
  const offeredDocuments = getEffectiveOfferedDocuments(p.availableDocuments);

  // Maximum sheet height: 78% of screen, responsive to insets
  const maxSheetHeight = Math.min(height * 0.78, height - insets.top - 60);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Light backdrop overlay */}
      <Animated.View
        style={[
          styles.backdrop,
          {
            opacity: opacity.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 0.35],
            }),
          },
        ]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleDismiss}
          accessibilityRole="button"
          accessibilityLabel="Dismiss parish details"
        />
      </Animated.View>

      {/* Sliding Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheetContainer,
          {
            maxHeight: maxSheetHeight,
            paddingBottom: contentBottomInset("tab"),
            transform: [{ translateY }],
            opacity,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Details for ${p.name}`}
      >
        {/* Drag Handle & Gesture Header Slot */}
        <View {...panResponder.panHandlers} style={styles.dragHeaderZone}>
          <View style={styles.dragHandle} />
          <View style={styles.topBar}>
            <View style={styles.topBadgeRow}>
              {p.type ? (
                <StatusLabel label={p.type} status="default" showDot={false} />
              ) : null}
              {p.isMotherParish ? (
                <StatusLabel label="Mother Parish" status="neutral" showDot={false} />
              ) : null}
              {p.feastDay ? (
                <StatusLabel label={`Feast: ${p.feastDay}`} status="neutral" showDot={false} />
              ) : null}
            </View>

            <IconButton
              size={44}
              onPress={handleDismiss}
              accessibilityLabel="Close parish information sheet"
              accessibilityHint="Dismisses this bottom sheet and returns to the map"
              style={styles.closeBtn}
            >
              <Ionicons name="close" size={22} color={colors.neutral[800]} />
            </IconButton>
          </View>
        </View>

        {/* Scrollable Information Body */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          bounces={false}
          showsVerticalScrollIndicator={true}
        >
          {/* Cover image if available */}
          {hasCoverImage ? (
            <View style={styles.imageWrapper}>
              <Image
                source={{ uri: p.coverImage }}
                style={styles.coverImage}
                resizeMode="cover"
                onError={() => setFailedImageId(p.id)}
                accessibilityElementsHidden={true}
                importantForAccessibility="no"
              />
            </View>
          ) : null}

          {/* Parish Title & Meta */}
          <View style={styles.titleSection}>
            <Text
              style={styles.parishTitle}
              numberOfLines={2}
              accessibilityRole="header"
              allowFontScaling
            >
              {p.name}
            </Text>

            {p.patronSaint ? (
              <View style={styles.metaRow}>
                <Ionicons
                  name="sparkles-outline"
                  size={14}
                  color={colors.primary}
                  style={styles.metaIcon}
                />
                <Text style={styles.patronText} numberOfLines={1} allowFontScaling>
                  Patron Saint: {p.patronSaint}
                </Text>
              </View>
            ) : null}

            {locationLabel || p.address ? (
              <View style={styles.metaRow}>
                <Ionicons
                  name="location-outline"
                  size={14}
                  color={colors.textSecondary}
                  style={styles.metaIcon}
                />
                <Text style={styles.addressText} numberOfLines={2} allowFontScaling>
                  {p.address || locationLabel}
                </Text>
              </View>
            ) : null}
          </View>

          {/* Quick Contact & Directions Bar */}
          {phoneUrl || emailUrl || mapUrl ? (
            <View style={styles.contactBar}>
              {phoneUrl ? (
                <Button
                  title="Call"
                  variant="secondary"
                  size="sm"
                  icon="call-outline"
                  onPress={() => {
                    void openExternalUrl(phoneUrl);
                  }}
                  accessibilityLabel={`Call ${p.name}`}
                  style={styles.actionBtn}
                />
              ) : null}

              {emailUrl ? (
                <Button
                  title="Email"
                  variant="secondary"
                  size="sm"
                  icon="mail-outline"
                  onPress={() => {
                    void openExternalUrl(emailUrl);
                  }}
                  accessibilityLabel={`Email ${p.name}`}
                  style={styles.actionBtn}
                />
              ) : null}

              {mapUrl ? (
                <Button
                  title="Directions"
                  variant="secondary"
                  size="sm"
                  icon="navigate-outline"
                  onPress={() => {
                    void openExternalUrl(mapUrl);
                  }}
                  accessibilityLabel={`Directions to ${p.name}`}
                  style={styles.actionBtn}
                />
              ) : null}
            </View>
          ) : null}

          {/* Description Section if present */}
          {p.directoryDescription ? (
            <View style={styles.descriptionSection}>
              <Text style={styles.sectionHeader} allowFontScaling>
                About the Parish
              </Text>
              <Text style={styles.descriptionBody} allowFontScaling>
                {p.directoryDescription}
              </Text>
            </View>
          ) : null}

          {/* Office Hours Section if present */}
          {officeHoursRows.length > 0 ? (
            <View style={styles.officeHoursCard}>
              <View style={styles.officeHoursHeader}>
                <Ionicons
                  name="time-outline"
                  size={15}
                  color={colors.primary}
                  style={styles.metaIcon}
                />
                <Text style={styles.sectionHeader} allowFontScaling>
                  Parish Office Hours
                </Text>
              </View>
              <View style={styles.officeHoursList}>
                {officeHoursRows.map((row) => (
                  <View key={row.day} style={styles.officeHoursRow}>
                    <Text style={styles.officeHoursDay} allowFontScaling>
                      {row.day}
                    </Text>
                    <Text
                      style={[
                        styles.officeHoursVal,
                        row.hours === "Closed" && styles.officeHoursClosed,
                      ]}
                      allowFontScaling
                    >
                      {row.hours}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* Primary Action Buttons */}
          <View style={styles.primaryActionsGroup}>
            {/* Request Document CTA if certificates offered */}
            {offeredDocuments.length > 0 ? (
              <Button
                title="Request Document"
                variant="primary"
                size="md"
                icon="document-text-outline"
                onPress={() => {
                  requireCompleteProfile(() => {
                    router.push(`/(app)/requests/new?parishId=${p.id}` as any);
                  });
                }}
                accessibilityLabel={`Request sacramental certificate from ${p.name}`}
                style={styles.primaryBtn}
              />
            ) : null}

            {/* View Full Profile / Details Button */}
            <Button
              title="Full Details & Events"
              variant="secondary"
              size="md"
              icon="arrow-forward"
              onPress={() => {
                router.push(`/parishes/${p.id}` as any);
              }}
              accessibilityLabel={`View complete details and scheduled events for ${p.name}`}
              style={styles.secondaryBtn}
            />
          </View>
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
  },
  sheetContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.borderLight,
    ...shadows.sheet,
    elevation: 8,
    overflow: "hidden",
  },
  dragHeaderZone: {
    paddingTop: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  dragHandle: {
    width: 38,
    height: 4.5,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[300],
    marginBottom: spacing.xs,
  },
  topBar: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.xs,
  },
  topBadgeRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    alignItems: "center",
    marginRight: spacing.xs,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flexShrink: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  imageWrapper: {
    width: "100%",
    height: 140,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceVariant,
    marginBottom: spacing.xs,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  titleSection: {
    gap: 3,
  },
  parishTitle: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 18,
    lineHeight: 24,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 2,
  },
  metaIcon: {
    marginRight: spacing.xs,
    marginTop: 2,
  },
  patronText: {
    ...fontStyles.bodySmall,
    color: colors.primary,
    fontWeight: "600",
    fontSize: 13,
    flex: 1,
  },
  addressText: {
    ...fontStyles.bodySmall,
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  contactBar: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
    minHeight: 38,
  },
  descriptionSection: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginTop: spacing.xxs,
  },
  sectionHeader: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  descriptionBody: {
    ...fontStyles.bodySmall,
    color: colors.neutral[800],
    lineHeight: 18,
  },
  officeHoursCard: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  officeHoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  officeHoursList: {
    gap: 4,
  },
  officeHoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  officeHoursDay: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontWeight: "600",
    width: 80,
  },
  officeHoursVal: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  officeHoursClosed: {
    color: colors.neutral[500],
    fontStyle: "italic",
  },
  primaryActionsGroup: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  primaryBtn: {
    width: "100%",
  },
  secondaryBtn: {
    width: "100%",
  },
});
