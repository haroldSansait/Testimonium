import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  BackHandler,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";

export interface QuickActionSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectAction: (destination: string) => void;
  currentPathname?: string;
}

export interface ActionItem {
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  destination: string;
  activeMatcher: (path?: string) => boolean;
  iconColor: string;
  iconBgColor: string;
}

export const ACTION_ITEMS: ActionItem[] = [
  {
    id: "requests",
    title: "Request a Document",
    subtitle: "Certificates and parish documents",
    icon: "document-text",
    destination: "/(app)/(tabs)/(requests)",
    activeMatcher: (path) => Boolean(path && path.includes("requests")),
    iconColor: colors.primary,
    iconBgColor: colors.primarySoft,
  },
  {
    id: "schedule",
    title: "Schedule a Service",
    subtitle: "Sacraments, Masses and parish events",
    icon: "calendar",
    destination: "/(app)/(tabs)/(schedule)",
    activeMatcher: (path) => Boolean(path && path.includes("schedule")),
    iconColor: colors.warning,
    iconBgColor: colors.warningSoft,
  },
  {
    id: "parishes",
    title: "Find a Parish",
    subtitle: "Parish directory and contact information",
    icon: "business",
    destination: "/(app)/(tabs)/(parishes)",
    activeMatcher: (path) => Boolean(path && path.includes("parishes")),
    iconColor: colors.info,
    iconBgColor: colors.infoSoft,
  },
];

export const createPanResponderCallbacks = (
  onDismiss: () => void,
  onReset: () => void,
  dragY: Animated.Value
) => ({
  onStartShouldSetPanResponder: () => false,
  onStartShouldSetPanResponderCapture: () => false,
  onMoveShouldSetPanResponder: (_: unknown, gestureState: { dy: number; dx: number }) => {
    // Only respond to deliberate downward drag (dy > 10, predominantly vertical)
    return (
      gestureState.dy > 10 &&
      Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2
    );
  },
  onMoveShouldSetPanResponderCapture: (_: unknown, gestureState: { dy: number; dx: number }) => {
    // Capture downward drag if moving past threshold to prevent action cards from receiving tap
    return (
      gestureState.dy > 14 &&
      Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5
    );
  },
  onPanResponderGrant: () => {},
  onPanResponderMove: (_: unknown, gestureState: { dy: number }) => {
    // translationY = max(0, gesture.dy) - strictly downward only
    const dy = Math.max(0, gestureState.dy);
    dragY.setValue(dy);
  },
  onPanResponderRelease: (_: unknown, gestureState: { dy: number; vy: number }) => {
    // Dismiss if dragged down > 100dp OR if downward release velocity is significant
    if (gestureState.dy > 100 || (gestureState.dy > 40 && gestureState.vy > 0.5)) {
      onDismiss();
    } else {
      onReset();
    }
  },
  onPanResponderTerminate: () => {
    onReset();
  },
});

export const QuickActionSheet: React.FC<QuickActionSheetProps> = ({
  visible,
  onClose,
  onSelectAction,
  currentPathname,
}) => {
  const insets = useSafeAreaInsets();
  const [slideAnim] = useState(() => new Animated.Value(300));
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [dragY] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled?.().then((enabled) => {
      setReduceMotion(Boolean(enabled));
    });
  }, []);

  // Handle hardware Back button on Android
  useEffect(() => {
    if (!visible) return;
    const backHandler = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        onClose();
        return true;
      }
    );
    return () => backHandler.remove();
  }, [visible, onClose]);

  // Handle opening & closing slide animations
  useEffect(() => {
    if (visible) {
      isNavigatingRef.current = false;
      dragY.setValue(0);
      if (reduceMotion) {
        slideAnim.setValue(0);
        fadeAnim.setValue(1);
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 180,
            useNativeDriver: true,
          }),
          Animated.spring(slideAnim, {
            toValue: 0,
            friction: 8,
            tension: 65,
            useNativeDriver: true,
          }),
        ]).start();
      }
    } else {
      dragY.setValue(0);
      if (reduceMotion) {
        slideAnim.setValue(300);
        fadeAnim.setValue(0);
      } else {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 140,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 300,
            duration: 160,
            useNativeDriver: true,
          }),
        ]).start();
      }
    }
  }, [visible, slideAnim, fadeAnim, dragY, reduceMotion]);

  const panResponder = useMemo(
    () =>
      PanResponder.create(
        createPanResponderCallbacks(
          () => {
            dragY.setValue(0);
            onClose();
          },
          () => {
            if (reduceMotion) {
              dragY.setValue(0);
            } else {
              Animated.spring(dragY, {
                toValue: 0,
                tension: 75,
                friction: 9,
                useNativeDriver: true,
              }).start();
            }
          },
          dragY
        )
      ),
    [dragY, onClose, reduceMotion]
  );

  const handleActionPress = (destination: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    // Close sheet before navigating to prevent double push
    onClose();
    onSelectAction(destination);
  };

  if (!visible) {
    return null;
  }

  const bottomInset = Math.max(insets.bottom, 16);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        {/* Dimmed backdrop - tap to dismiss */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss quick actions"
          />
        </Animated.View>

        {/* Slide-up sheet with pan responder for downward drag dismissal */}
        <Animated.View
          {...panResponder.panHandlers}
          accessibilityLabel="Quick Actions Sheet"
          accessibilityHint="Swipe down or activate close to dismiss."
          style={[
            styles.sheetContainer,
            {
              paddingBottom: bottomInset + spacing.sm,
              transform: [{ translateY: Animated.add(slideAnim, dragY) }],
            },
          ]}
        >
          {/* Handle indicator */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} allowFontScaling>
              Quick Actions
            </Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Close quick actions"
              accessibilityHint="Dismisses the quick action menu"
              hitSlop={8}
            >
              <Ionicons name="close" size={22} color={colors.textPrimary} />
            </Pressable>
          </View>

          {/* Action List */}
          <View style={styles.actionsList}>
            {ACTION_ITEMS.map((item) => {
              const isCurrent = item.activeMatcher(currentPathname);
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleActionPress(item.destination)}
                  style={({ pressed }) => [
                    styles.actionCard,
                    isCurrent && styles.actionCardCurrent,
                    pressed && styles.actionCardPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${item.subtitle}${
                    isCurrent ? ", Current section" : ""
                  }`}
                >
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: item.iconBgColor },
                      isCurrent && styles.iconCircleCurrent,
                    ]}
                  >
                    <Ionicons
                      name={item.icon}
                      size={22}
                      color={item.iconColor}
                    />
                  </View>
                  <View style={styles.textContainer}>
                    <View style={styles.titleRow}>
                      <Text
                        style={[
                          styles.actionTitle,
                          isCurrent && styles.actionTitleCurrent,
                        ]}
                        allowFontScaling
                      >
                        {item.title}
                      </Text>
                      {isCurrent && (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>ACTIVE</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.actionSubtitle} allowFontScaling>
                      {item.subtitle}
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 20,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 38,
    height: 4.5,
    borderRadius: 2.5,
    backgroundColor: colors.borderStrong,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  title: {
    ...fontStyles.heading,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceVariant,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  actionsList: {
    paddingVertical: spacing.sm,
    gap: spacing.xs + 2,
  },
  actionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    minHeight: 64,
  },
  actionCardCurrent: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft + "30",
  },
  actionCardPressed: {
    backgroundColor: colors.surfaceVariant,
    transform: [{ scale: 0.985 }],
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
  },
  iconCircleCurrent: {
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  textContainer: {
    flex: 1,
    justifyContent: "center",
    marginRight: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  actionTitle: {
    ...fontStyles.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "600",
    fontSize: 15,
  },
  actionTitleCurrent: {
    color: colors.primary,
    fontWeight: "700",
  },
  activeBadge: {
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radii.sm,
  },
  activeBadgeText: {
    ...fontStyles.meta,
    fontSize: 9,
    fontWeight: "800",
    color: colors.primary,
    letterSpacing: 0.5,
  },
  actionSubtitle: {
    ...fontStyles.meta,
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
});
