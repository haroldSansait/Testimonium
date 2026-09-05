import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, radii, shadows, spacing } from "@/theme/tokens";
import { Button } from "./Button";

export type FeedbackType = "success" | "error" | "warning" | "info" | "confirm";

export interface FeedbackModalProps {
  visible: boolean;
  type?: FeedbackType;
  title: string;
  message?: string;
  referenceNumber?: string | null;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel?: () => void;
  onClose?: () => void;
}

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  visible,
  type = "info",
  title,
  message,
  referenceNumber,
  confirmText = "OK",
  cancelText,
  isDestructive = false,
  onConfirm,
  onCancel,
  onClose,
}) => {
  const isExecutingRef = useRef(false);
  const [fadeAnim] = useState(() => new Animated.Value(0));
  const [scaleAnim] = useState(() => new Animated.Value(0.92));

  useEffect(() => {
    if (!visible) return;
    isExecutingRef.current = false;
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 8,
        tension: 65,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, fadeAnim, scaleAnim]);

  if (!visible) {
    return null;
  }

  const handleConfirm = async () => {
    if (isExecutingRef.current) return;
    isExecutingRef.current = true;
    try {
      await onConfirm();
    } finally {
      isExecutingRef.current = false;
    }
  };

  const handleCancel = () => {
    if (isExecutingRef.current) return;
    if (onCancel) {
      onCancel();
    } else if (onClose) {
      onClose();
    }
  };

  const handleBackdropPress = () => {
    // Destructive confirmations should not accidentally dismiss on backdrop tap
    if (type === "confirm" || isDestructive || isExecutingRef.current) return;
    if (onCancel) {
      onCancel();
    } else if (onClose) {
      onClose();
    }
  };

  const getStatusIcon = () => {
    switch (type) {
      case "success":
        return {
          name: "checkmark-circle" as const,
          color: colors.success,
          bgColor: colors.successSoft,
        };
      case "error":
        return {
          name: "close-circle" as const,
          color: colors.danger,
          bgColor: colors.dangerSoft,
        };
      case "warning":
        return {
          name: "alert-circle" as const,
          color: colors.warning,
          bgColor: colors.warningSoft,
        };
      case "confirm":
        return {
          name: isDestructive ? "trash-outline" as const : "help-circle" as const,
          color: isDestructive ? colors.danger : colors.primary,
          bgColor: isDestructive ? colors.dangerSoft : colors.primarySoft,
        };
      case "info":
      default:
        return {
          name: "information-circle" as const,
          color: colors.info,
          bgColor: colors.infoSoft,
        };
    }
  };

  const iconInfo = getStatusIcon();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
          accessibilityRole="button"
          accessibilityLabel="Dismiss dialog background"
        />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          {/* Status Icon */}
          <View
            style={[
              styles.iconCircle,
              { backgroundColor: iconInfo.bgColor },
            ]}
          >
            <Ionicons name={iconInfo.name} size={36} color={iconInfo.color} />
          </View>

          {/* Title & Message */}
          <Text style={styles.title} allowFontScaling>
            {title}
          </Text>

          {message ? (
            <Text style={styles.message} allowFontScaling>
              {message}
            </Text>
          ) : null}

          {/* Optional Reference Number Pill */}
          {referenceNumber ? (
            <View style={styles.refContainer}>
              <Text style={styles.refLabel} allowFontScaling>
                Reference Number
              </Text>
              <View style={styles.refBadge}>
                <Ionicons
                  name="barcode-outline"
                  size={16}
                  color={colors.primary}
                  style={styles.refIcon}
                />
                <Text style={styles.refNumber} allowFontScaling>
                  {referenceNumber}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Action Buttons */}
          <View style={styles.actionsRow}>
            {cancelText ? (
              <Button
                testID="feedback-modal-cancel-btn"
                title={cancelText}
                variant="outline"
                size="md"
                onPress={handleCancel}
                style={styles.actionBtn}
                accessibilityLabel={cancelText}
              />
            ) : null}

            <Button
              testID="feedback-modal-confirm-btn"
              title={confirmText}
              variant={isDestructive ? "danger" : "primary"}
              size="md"
              onPress={handleConfirm}
              style={styles.actionBtn}
              accessibilityLabel={confirmText}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.lg,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  title: {
    ...fontStyles.titleMedium,
    color: colors.textPrimary,
    textAlign: "center",
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  message: {
    ...fontStyles.body,
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  refContainer: {
    width: "100%",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  refLabel: {
    ...fontStyles.caption,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xxs,
  },
  refBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  refIcon: {
    marginRight: 2,
  },
  refNumber: {
    ...fontStyles.bodyMedium,
    color: colors.primary,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  actionsRow: {
    flexDirection: "row",
    width: "100%",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
