import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  BackHandler,
  Easing,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Button, IconButton } from "@/components/ui";
import { useAppLayoutMetrics } from "@/components/layout/useAppLayoutMetrics";
import { useRequireCompleteProfile } from "@/hooks/useRequireCompleteProfile";
import {
  formatDocumentType,
  getEffectiveOfferedDocuments,
} from "@/features/requests/presentation";
import { colors, fontStyles, radii, spacing, shadows } from "@/theme/tokens";
import { useParishDetail } from "../api";
import type { CouncilMember, ParishDto } from "../types";
import {
  buildEmailUrl,
  buildMapUrl,
  buildPhoneUrl,
  formatOfficeHours,
  getOfficeOpenStatus,
  openExternalUrl,
} from "../utils";

export interface ParishInfoSheetProps {
  parish: ParishDto | null;
  visible: boolean;
  onClose: () => void;
}

const ANIMATION_DURATION = 260;
const DISMISS_DRAG_THRESHOLD = 70;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
const DAY_ABBR: Record<string, string> = {
  Monday: "Mon",
  Tuesday: "Tue",
  Wednesday: "Wed",
  Thursday: "Thu",
  Friday: "Fri",
  Saturday: "Sat",
  Sunday: "Sun",
};

const getInitials = (name?: string): string => {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const CouncilAvatar: React.FC<{ photoUrl?: string | null; name: string }> = ({
  photoUrl,
  name,
}) => {
  const [hasError, setHasError] = useState(false);

  if (photoUrl && !hasError) {
    return (
      <Image
        source={{ uri: photoUrl }}
        style={styles.councilAvatarImg}
        onError={() => setHasError(true)}
      />
    );
  }

  return (
    <View style={styles.councilAvatarFallback}>
      <Text style={styles.councilAvatarInitials} allowFontScaling>
        {getInitials(name)}
      </Text>
    </View>
  );
};

export const ParishInfoSheet: React.FC<ParishInfoSheetProps> = ({
  parish,
  visible,
  onClose,
}) => {
  const router = useRouter();
  const { height, insets } = useAppLayoutMetrics();
  const { requireCompleteProfile } = useRequireCompleteProfile();

  const [failedImageId, setFailedImageId] = useState<string | null>(null);
  const [failedGalleryUrls, setFailedGalleryUrls] = useState<Set<string>>(new Set());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [containerHeight, setContainerHeight] = useState<number>(0);

  // Animated values for entrance & interactive dragging (useState for React 19 compiler safety)
  const [translateY] = useState(() => new Animated.Value(height));
  const [opacity] = useState(() => new Animated.Value(0));

  // Fetch full parish detail if available, keyed strictly to selected parish
  const { data: detailData, isLoading: isLoadingDetail } = useParishDetail(
    visible && parish?.id ? parish.id : undefined
  );

  // Merge list DTO with detail DTO only when IDs match to prevent cross-parish data leaks
  const isHydrated = Boolean(
    detailData && parish && String(detailData.id) === String(parish.id)
  );

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

  // PanResponder for handle swipe-down dismissal
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
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

  const locationLabel = [p.municipalityCity, p.province].filter(Boolean).join(", ");
  const offeredDocuments = getEffectiveOfferedDocuments(p.availableDocuments);

  // Office open status calculated with device's local timezone
  const officeStatus = getOfficeOpenStatus(p.officeHours);

  // Weekly schedule rows mapped to Mon-Sun
  const formattedHoursRows = formatOfficeHours(p.officeHours);
  const hoursMap = new Map<string, string>();
  for (const row of formattedHoursRows) {
    hoursMap.set(row.day.toLowerCase(), row.hours);
  }

  const weeklySchedule = DAYS.map((day) => {
    const hours = hoursMap.get(day.toLowerCase()) || (formattedHoursRows.length > 0 ? "Closed" : "—");
    const isClosed = hours === "Closed" || hours === "—";
    return {
      day: DAY_ABBR[day],
      fullDay: day,
      hours,
      isClosed,
    };
  });

  // Unique gallery images with cover image fallback
  const galleryImages = (() => {
    const raw = Array.isArray(p.gallery) && p.gallery.length > 0
      ? p.gallery
      : (p.coverImage && p.coverImage.startsWith("http") ? [p.coverImage] : []);
    const valid = raw.filter(
      (url) => typeof url === "string" && url.trim().length > 0 && url.startsWith("http")
    );
    return Array.from(new Set(valid));
  })();

  // Parish Administration fields
  const assignedPriest = p.priest || p.priestName || "Unassigned";
  const assistantPriests = Array.isArray(p.assistantPriests) ? p.assistantPriests : [];
  const assignedSecretary = p.secretary || p.secretaryName || "Unassigned";

  // Councils
  const councils = p.councils;
  const pastoralMembers: CouncilMember[] = councils?.pastoral?.members || [];
  const financeCouncil = councils?.finance ?? null;
  const financeMembers: CouncilMember[] = financeCouncil?.members || [];

  // Sheet max height inside available map viewport.
  // Constrain strictly to container layout so drag handle and close button are NEVER clipped off by parent overflow.
  const availableHeight =
    containerHeight > 0
      ? containerHeight
      : Math.min(height * 0.70, height - insets.top - 120);
  const maxSheetHeight = Math.max(200, availableHeight - 12);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
      onLayout={(e) => {
        const h = e.nativeEvent.layout.height;
        if (h > 0) {
          setContainerHeight(h);
        }
      }}
    >
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
            transform: [{ translateY }],
            opacity,
          },
        ]}
        accessibilityRole="summary"
        accessibilityLabel={`Details for ${p.name}`}
      >
        {/* 1. Drag Handle & Header Close Bar */}
        <View style={styles.dragHeaderZone}>
          <View style={styles.dragHandleContainer} {...panResponder.panHandlers}>
            <View style={styles.dragHandle} />
          </View>
          <IconButton
            size={36}
            onPress={handleDismiss}
            accessibilityLabel="Close parish information sheet"
            accessibilityHint="Dismisses this bottom sheet and returns to the map"
            style={styles.closeBtn}
          >
            <Ionicons name="close" size={22} color={colors.neutral[800]} />
          </IconButton>
        </View>

        {/* Scrollable Information Body */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          bounces={true}
          showsVerticalScrollIndicator={true}
        >
          {/* 2. Cover image, parish name, patron saint, office status */}
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

          {/* Title & Status Badges */}
          <View style={styles.titleSection}>
            <View style={styles.statusBadgeRow}>
              {/* Office Status Badge (Open Now / Closed / Hours Unavailable) */}
              {officeStatus.status === "OPEN" ? (
                <View style={[styles.badgePill, styles.statusOpenBadge]}>
                  <View style={[styles.statusDot, styles.dotOpen]} />
                  <Text style={styles.statusOpenText}>Open Now</Text>
                </View>
              ) : officeStatus.status === "CLOSED" ? (
                <View style={[styles.badgePill, styles.statusClosedBadge]}>
                  <View style={[styles.statusDot, styles.dotClosed]} />
                  <Text style={styles.statusClosedText}>Closed</Text>
                </View>
              ) : (
                <View style={[styles.badgePill, styles.statusUnavailableBadge]}>
                  <Text style={styles.statusUnavailableText}>Hours Unavailable</Text>
                </View>
              )}

              {/* Mother Parish Badge */}
              {p.isMotherParish ? (
                <View style={[styles.badgePill, styles.motherBadge]}>
                  <Ionicons
                    name="ribbon-outline"
                    size={11}
                    color={colors.primary}
                    style={styles.badgeIcon}
                  />
                  <Text style={styles.motherBadgeText}>Mother Parish</Text>
                </View>
              ) : null}

              {/* Feast Day Badge */}
              {p.feastDay ? (
                <View style={[styles.badgePill, styles.feastBadge]}>
                  <Ionicons
                    name="calendar-outline"
                    size={11}
                    color={colors.neutral[650]}
                    style={styles.badgeIcon}
                  />
                  <Text style={styles.feastBadgeText}>Feast: {p.feastDay}</Text>
                </View>
              ) : null}
            </View>

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
          </View>

          {/* 3. Contact & Location Information Card */}
          <View style={styles.sectionCard}>
            {/* Address */}
            {p.address || locationLabel ? (
              <View style={styles.contactItemRow}>
                <Ionicons
                  name="location-outline"
                  size={15}
                  color={colors.primary}
                  style={styles.contactItemIcon}
                />
                <View style={styles.contactItemTextCol}>
                  {p.address ? (
                    <Text style={styles.contactPrimaryText} allowFontScaling>
                      {p.address}
                    </Text>
                  ) : null}
                  {locationLabel ? (
                    <Text style={styles.contactSecondaryText} allowFontScaling>
                      {locationLabel}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Phone */}
            {p.contactNumber ? (
              <View style={styles.contactItemRow}>
                <Ionicons
                  name="call-outline"
                  size={15}
                  color={colors.primary}
                  style={styles.contactItemIcon}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (phoneUrl) void openExternalUrl(phoneUrl);
                  }}
                  disabled={!phoneUrl}
                  style={styles.contactItemTextCol}
                  accessibilityRole="link"
                  accessibilityLabel={`Call ${p.name} at ${p.contactNumber}`}
                >
                  <Text style={[styles.contactPrimaryText, phoneUrl && styles.contactLinkText]}>
                    {p.contactNumber}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Email */}
            {p.email ? (
              <View style={styles.contactItemRow}>
                <Ionicons
                  name="mail-outline"
                  size={15}
                  color={colors.primary}
                  style={styles.contactItemIcon}
                />
                <TouchableOpacity
                  onPress={() => {
                    if (emailUrl) void openExternalUrl(emailUrl);
                  }}
                  disabled={!emailUrl}
                  style={styles.contactItemTextCol}
                  accessibilityRole="link"
                  accessibilityLabel={`Email ${p.name} at ${p.email}`}
                >
                  <Text
                    style={[styles.contactPrimaryText, emailUrl && styles.contactLinkText]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {p.email}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Facebook Page */}
            {p.facebookPage ? (
              <View style={styles.contactItemRow}>
                <Ionicons
                  name="globe-outline"
                  size={15}
                  color={colors.primary}
                  style={styles.contactItemIcon}
                />
                <TouchableOpacity
                  onPress={() => {
                    void openExternalUrl(p.facebookPage || null);
                  }}
                  style={styles.contactItemTextCol}
                  accessibilityRole="link"
                  accessibilityLabel={`Visit Official Facebook Page of ${p.name}`}
                >
                  <Text style={[styles.contactPrimaryText, styles.contactLinkText]}>
                    Official Facebook Page
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Seating Capacity */}
            {p.venueCapacity ? (
              <View style={[styles.contactItemRow, styles.capacityBorderTop]}>
                <Ionicons
                  name="people-outline"
                  size={14}
                  color={colors.textSecondary}
                  style={styles.contactItemIcon}
                />
                <View style={styles.capacityTextRow}>
                  <Text style={styles.capacityLabel} allowFontScaling>Seating Capacity: </Text>
                  <Text style={styles.capacityText} allowFontScaling>~{p.venueCapacity.toLocaleString()} attendees</Text>
                </View>
              </View>
            ) : null}
          </View>

          {/* 4. About the Parish */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionHeader} allowFontScaling>
              About the Parish
            </Text>
            <Text style={styles.descriptionBody} allowFontScaling>
              {p.directoryDescription || "Welcome to our parish community under the Vicariate of Canlaon."}
            </Text>
          </View>

          {/* 5. Parish Gallery */}
          {galleryImages.length > 0 ? (
            <View style={styles.sectionCard}>
              <Text style={styles.sectionHeader} allowFontScaling>
                Parish Gallery
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.galleryScroll}
              >
                {galleryImages.map((imgUrl, idx) => {
                  if (failedGalleryUrls.has(imgUrl)) return null;
                  return (
                    <View key={`${imgUrl}-${idx}`} style={styles.galleryThumbWrapper}>
                      <Image
                        source={{ uri: imgUrl }}
                        style={styles.galleryThumb}
                        resizeMode="cover"
                        onError={() => {
                          setFailedGalleryUrls((prev) => new Set(prev).add(imgUrl));
                        }}
                        accessibilityLabel={`${p.name} gallery image ${idx + 1}`}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* 6. Parish Administration */}
          <View style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Ionicons name="person-outline" size={13} color={colors.primary} style={styles.cardHeaderIcon} />
              <Text style={styles.sectionHeader} allowFontScaling>
                Parish Administration
              </Text>
            </View>
            <View style={styles.personnelList}>
              <Text style={styles.personnelPriest} allowFontScaling>
                Parish Priest: {assignedPriest}
              </Text>
              {assistantPriests.map((asst) => (
                <Text key={asst.id} style={styles.personnelVicar} allowFontScaling>
                  Parochial Vicar: {asst.name}
                </Text>
              ))}
              <Text style={styles.personnelSecretary} allowFontScaling>
                Secretary: {assignedSecretary}
              </Text>
            </View>
          </View>

          {/* 7. Parish Office Hours */}
          <View style={styles.sectionCard}>
            <View style={styles.officeHoursHeader}>
              <View style={styles.cardHeaderRow}>
                <Ionicons
                  name="time-outline"
                  size={13}
                  color={colors.primary}
                  style={styles.cardHeaderIcon}
                />
                <Text style={styles.sectionHeader} allowFontScaling>
                  Office Hours
                </Text>
              </View>
              <Text style={styles.weeklyScheduleCaption} allowFontScaling>
                Weekly Schedule
              </Text>
            </View>
            <View style={styles.officeHoursList}>
              {weeklySchedule.map((row) => (
                <View key={row.fullDay} style={styles.officeHoursRow}>
                  <Text style={styles.officeHoursDay} allowFontScaling>
                    {row.day}
                  </Text>
                  <Text
                    style={[
                      styles.officeHoursVal,
                      row.isClosed && styles.officeHoursClosed,
                    ]}
                    allowFontScaling
                  >
                    {row.hours}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* 8. Offered Certificates */}
          {offeredDocuments.length > 0 ? (
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons
                  name="document-text-outline"
                  size={13}
                  color={colors.primary}
                  style={styles.cardHeaderIcon}
                />
                <Text style={styles.sectionHeader} allowFontScaling>
                  Offered Certificates
                </Text>
              </View>
              <View style={styles.certificatesWrapper}>
                {offeredDocuments.map((docType) => (
                  <View key={docType} style={styles.certificateChip}>
                    <Text style={styles.certificateChipText} allowFontScaling>
                      {formatDocumentType(docType)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {/* 9. Parish Pastoral Council & Parish Finance Council */}
          {isLoadingDetail && !isHydrated ? (
            /* Councils Loading State */
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="people-outline" size={13} color={colors.primary} style={styles.cardHeaderIcon} />
                <Text style={styles.sectionHeader} allowFontScaling>
                  Parish Councils
                </Text>
              </View>
              <View style={styles.councilLoadingState}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.councilMutedText} allowFontScaling>
                  Loading council directory…
                </Text>
              </View>
            </View>
          ) : councils === null || councils === undefined ? (
            /* Councils Unavailable State */
            <View style={styles.sectionCard}>
              <View style={styles.cardHeaderRow}>
                <Ionicons name="people-outline" size={13} color={colors.primary} style={styles.cardHeaderIcon} />
                <Text style={styles.sectionHeader} allowFontScaling>
                  Parish Councils
                </Text>
              </View>
              <View style={styles.councilNoticeRow}>
                <Ionicons name="information-circle-outline" size={14} color={colors.neutral[500]} />
                <Text style={styles.councilMutedText} allowFontScaling>
                  Council information is currently unavailable.
                </Text>
              </View>
            </View>
          ) : (
            <>
              {/* Parish Pastoral Council */}
              <View style={styles.sectionCard}>
                <View style={styles.councilHeaderRow}>
                  <View style={styles.cardHeaderRow}>
                    <Ionicons name="people-outline" size={13} color={colors.primary} style={styles.cardHeaderIcon} />
                    <Text style={styles.sectionHeader} allowFontScaling>
                      Parish Pastoral Council
                    </Text>
                  </View>
                  <Text style={styles.councilCountBadge} allowFontScaling>
                    {pastoralMembers.length > 0
                      ? `${pastoralMembers.length} ${pastoralMembers.length === 1 ? "Officer" : "Officers"}`
                      : "Directory"}
                  </Text>
                </View>

                {pastoralMembers.length === 0 ? (
                  <Text style={styles.councilEmptyText} allowFontScaling>
                    Parish Pastoral Council information has not yet been added.
                  </Text>
                ) : (
                  <View style={styles.councilList}>
                    {pastoralMembers.map((member, index) => (
                      <View
                        key={`ppc-${index}-${member.positionTitle}-${member.memberName}`}
                        style={styles.councilMemberRow}
                      >
                        <CouncilAvatar photoUrl={member.photoUrl} name={member.memberName} />
                        <View style={styles.councilMemberTextCol}>
                          <Text
                            style={styles.councilPositionText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            allowFontScaling
                          >
                            {member.positionTitle}
                          </Text>
                          <Text
                            style={styles.councilNameText}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                            allowFontScaling
                          >
                            {member.memberName}
                          </Text>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Parish Finance Council (Only when enabled / non-null) */}
              {financeCouncil !== null ? (
                <View style={styles.sectionCard}>
                  <View style={styles.councilHeaderRow}>
                    <View style={styles.cardHeaderRow}>
                      <Ionicons name="business-outline" size={13} color={colors.primary} style={styles.cardHeaderIcon} />
                      <Text style={styles.sectionHeader} allowFontScaling>
                        Parish Finance Council
                      </Text>
                    </View>
                    <Text style={styles.councilCountBadge} allowFontScaling>
                      {financeMembers.length > 0
                        ? `${financeMembers.length} ${financeMembers.length === 1 ? "Officer" : "Officers"}`
                        : "Directory"}
                    </Text>
                  </View>

                  {financeMembers.length === 0 ? (
                    <Text style={styles.councilEmptyText} allowFontScaling>
                      Parish Finance Council information has not yet been added.
                    </Text>
                  ) : (
                    <View style={styles.councilList}>
                      {financeMembers.map((member, index) => (
                        <View
                          key={`pfc-${index}-${member.positionTitle}-${member.memberName}`}
                          style={styles.councilMemberRow}
                        >
                          <CouncilAvatar photoUrl={member.photoUrl} name={member.memberName} />
                          <View style={styles.councilMemberTextCol}>
                            <Text
                              style={styles.councilPositionText}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              allowFontScaling
                            >
                              {member.positionTitle}
                            </Text>
                            <Text
                              style={styles.councilNameText}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                              allowFontScaling
                            >
                              {member.memberName}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ) : null}
            </>
          )}
        </ScrollView>

        {/* 10. Compact Sticky Bottom Footer */}
        <View style={styles.footerContainer}>
          {offeredDocuments.length > 0 ? (
            <Button
              title="Request Document"
              variant="primary"
              size="sm"
              icon="document-text-outline"
              iconSize={14}
              iconStyle={styles.footerBtnIcon}
              textStyle={styles.footerBtnText}
              onPress={() => {
                requireCompleteProfile(() => {
                  router.push(`/(app)/requests/new?parishId=${p.id}` as any);
                });
              }}
              accessibilityLabel={`Request sacramental certificate from ${p.name}`}
              style={styles.footerActionBtn}
            />
          ) : null}

          <Button
            title="Schedule Rite"
            variant="secondary"
            size="sm"
            icon="calendar-outline"
            iconSize={14}
            iconStyle={styles.footerBtnIcon}
            textStyle={styles.footerBtnText}
            onPress={() => {
              requireCompleteProfile(() => {
                router.push(`/(app)/schedule/new?parishId=${p.id}` as any);
              });
            }}
            accessibilityLabel={`Schedule rite at ${p.name}`}
            style={styles.footerActionBtn}
          />

          {mapUrl ? (
            <IconButton
              size={38}
              onPress={() => {
                void openExternalUrl(mapUrl);
              }}
              accessibilityLabel={`Directions to ${p.name}`}
              accessibilityHint="Opens parish location in Google Maps"
              style={styles.directionsBtn}
            >
              <Ionicons name="navigate-outline" size={18} color={colors.primary} />
            </IconButton>
          ) : null}
        </View>
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
    display: "flex",
    flexDirection: "column",
  },
  dragHeaderZone: {
    height: 44,
    backgroundColor: colors.surface,
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
    position: "relative",
  },
  dragHandleContainer: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: radii.full,
    backgroundColor: colors.neutral[500],
  },
  closeBtn: {
    position: "absolute",
    right: spacing.xs,
    top: 4,
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
  },
  imageWrapper: {
    width: "100%",
    height: 140,
    borderRadius: radii.sm,
    overflow: "hidden",
    backgroundColor: colors.surfaceVariant,
    marginBottom: spacing.xxs,
  },
  coverImage: {
    width: "100%",
    height: "100%",
  },
  titleSection: {
    gap: 4,
  },
  statusBadgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    marginBottom: 2,
  },
  badgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  badgeIcon: {
    marginRight: 3,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 4,
  },
  statusOpenBadge: {
    backgroundColor: "rgba(16, 185, 129, 0.10)",
    borderColor: "rgba(16, 185, 129, 0.35)",
  },
  dotOpen: {
    backgroundColor: "#10B981",
  },
  statusOpenText: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statusClosedBadge: {
    backgroundColor: "rgba(244, 63, 94, 0.10)",
    borderColor: "rgba(244, 63, 94, 0.35)",
  },
  dotClosed: {
    backgroundColor: "#F43F5E",
  },
  statusClosedText: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "700",
    color: "#E11D48",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  statusUnavailableBadge: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.borderLight,
  },
  statusUnavailableText: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral[650],
  },
  motherBadge: {
    backgroundColor: "rgba(123, 28, 42, 0.05)",
    borderColor: "rgba(123, 28, 42, 0.18)",
  },
  motherBadgeText: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "600",
    color: colors.primary,
  },
  feastBadge: {
    backgroundColor: colors.surfaceVariant,
    borderColor: colors.borderLight,
  },
  feastBadgeText: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral[800],
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
    marginTop: 1,
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
  sectionCard: {
    backgroundColor: colors.surfaceVariant,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderIcon: {
    marginRight: spacing.xs,
  },
  sectionHeader: {
    ...fontStyles.captionMedium,
    color: colors.textPrimary,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    fontSize: 11,
  },
  contactItemRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  contactItemIcon: {
    marginRight: spacing.xs,
    marginTop: 2,
    flexShrink: 0,
  },
  contactItemTextCol: {
    flex: 1,
    minWidth: 0,
  },
  contactPrimaryText: {
    ...fontStyles.bodySmall,
    color: colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
  },
  contactSecondaryText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 1,
  },
  contactLinkText: {
    color: colors.primary,
    fontWeight: "600",
  },
  capacityBorderTop: {
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[200],
    alignItems: "center",
  },
  capacityTextRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    flex: 1,
  },
  capacityText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 11,
  },
  capacityLabel: {
    fontWeight: "600",
    color: colors.textPrimary,
  },
  descriptionBody: {
    ...fontStyles.bodySmall,
    color: colors.neutral[800],
    lineHeight: 18,
    fontSize: 13,
  },
  galleryScroll: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  galleryThumbWrapper: {
    width: 90,
    height: 64,
    borderRadius: radii.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surface,
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  personnelList: {
    gap: 3,
  },
  personnelPriest: {
    ...fontStyles.bodySmall,
    fontWeight: "700",
    color: colors.textPrimary,
    fontSize: 13,
  },
  personnelVicar: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  personnelSecretary: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  officeHoursHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  weeklyScheduleCaption: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "500",
  },
  officeHoursList: {
    gap: 3,
  },
  officeHoursRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  officeHoursDay: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    fontWeight: "700",
    fontSize: 12,
    width: 44,
  },
  officeHoursVal: {
    ...fontStyles.caption,
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  officeHoursClosed: {
    color: colors.neutral[500],
    fontWeight: "400",
    fontStyle: "italic",
  },
  certificatesWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  certificateChip: {
    backgroundColor: colors.surface,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  certificateChipText: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "600",
    color: colors.neutral[800],
  },
  councilHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.neutral[200],
  },
  councilCountBadge: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: "600",
  },
  councilLoadingState: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  councilNoticeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 2,
  },
  councilMutedText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontSize: 12,
  },
  councilEmptyText: {
    ...fontStyles.caption,
    color: colors.textSecondary,
    fontStyle: "italic",
    paddingVertical: 2,
  },
  councilList: {
    gap: 6,
  },
  councilMemberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: 2,
  },
  councilAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
  },
  councilAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(123, 28, 42, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(123, 28, 42, 0.15)",
  },
  councilAvatarInitials: {
    ...fontStyles.caption,
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  councilMemberTextCol: {
    flex: 1,
    minWidth: 0,
  },
  councilPositionText: {
    ...fontStyles.caption,
    fontSize: 10,
    fontWeight: "700",
    color: colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  councilNameText: {
    ...fontStyles.bodySmall,
    fontSize: 12,
    fontWeight: "700",
    color: colors.textPrimary,
  },
  footerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.neutral[200],
    backgroundColor: colors.surface,
  },
  footerActionBtn: {
    flex: 1,
    minHeight: 38,
    paddingHorizontal: 4,
  },
  footerBtnIcon: {
    marginRight: 4,
  },
  footerBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  directionsBtn: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.borderLight,
    backgroundColor: colors.surfaceVariant,
    alignItems: "center",
    justifyContent: "center",
  },
});
