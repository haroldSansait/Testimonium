import React, { useEffect, useMemo, useRef, useState } from "react";
import {
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
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { colors, fontStyles, radii, shadows, spacing } from "@/theme/tokens";
import { Divider } from "../ui/Divider";

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
    // Deliberate downward drag (dy > 10, predominantly vertical)
    return (
      gestureState.dy > 10 &&
      Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2
    );
  },
  onMoveShouldSetPanResponderCapture: (_: unknown, gestureState: { dy: number; dx: number }) => {
    return (
      gestureState.dy > 14 &&
      Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.5
    );
  },
  onPanResponderGrant: () => {},
  onPanResponderMove: (_: unknown, gestureState: { dy: number }) => {
    const dy = Math.max(0, gestureState.dy);
    dragY.setValue(dy);
  },
  onPanResponderRelease: (_: unknown, gestureState: { dy: number; vy: number }) => {
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
  const reduceMotion = useReducedMotion();
  const isNavigatingRef = useRef(false);

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

  // Opening & closing slide animations
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
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: 200,
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
              Animated.timing(dragY, {
                toValue: 0,
                duration: 180,
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
        {/* Dimmed backdrop */}
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Dismiss quick actions"
          />
        </Animated.View>

        {/* Slide-up sheet */}
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
            <Text style={styles.title} accessibilityRole="header" allowFontScaling>
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
              <Ionicons name="close" size={22} color={colors.neutral[950]} />
            </Pressable>
          </View>

          {/* Action List - Flat divided rows, direct icons */}
          <View style={styles.actionsList}>
            {ACTION_ITEMS.map((item, index) => {
              const isCurrent = item.activeMatcher(currentPathname);
              return (
                <View key={item.id}>
                  <Pressable
                    onPress={() => handleActionPress(item.destination)}
                    style={({ pressed }) => [
                      styles.actionRow,
                      isCurrent && styles.actionRowCurrent,
                      pressed && styles.actionRowPressed,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${item.title}, ${item.subtitle}${
                      isCurrent ? ", Current section" : ""
                    }`}
                  >
                    <View style={styles.iconSlot}>
                      <Ionicons
                        name={item.icon}
                        size={24}
                        color={colors.brand[700]}
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
                          <View style={styles.activeDot} />
                        )}
                      </View>
                      <Text style={styles.actionSubtitle} allowFontScaling>
                        {item.subtitle}
                      </Text>
                    </View>

                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={colors.neutral[500]}
                    />
                  </Pressable>
                  {index < ACTION_ITEMS.length - 1 ? <Divider /> : null}
                </View>
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
    backgroundColor: colors.overlay,
  },
  sheetContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    ...shadows.sheet,
  },
  handleContainer: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[300],
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
  },
  title: {
    ...fontStyles.heading,
    color: colors.neutral[950],
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  actionsList: {
    paddingVertical: spacing.xs,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    minHeight: 56,
    borderRadius: radii.control,
  },
  actionRowCurrent: {
    backgroundColor: colors.brand[50],
  },
  actionRowPressed: {
    backgroundColor: colors.neutral[50],
  },
  iconSlot: {
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm,
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
    ...fontStyles.body,
    fontWeight: "600",
    color: colors.neutral[950],
  },
  actionTitleCurrent: {
    color: colors.brand[700],
    fontWeight: "700",
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand[700],
    marginLeft: 2,
  },
  actionSubtitle: {
    ...fontStyles.caption,
    color: colors.neutral[650],
    marginTop: 2,
  },
});
