import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, fontStyles, radii, spacing } from "@/theme/tokens";
import { Button } from "./Button";
import { Divider } from "./Divider";

export interface FilterSheetProps {
  visible: boolean;
  onClose: () => void;
  onApply: () => void;
  onReset?: () => void;
  title?: string;
  applyLabel?: string;
  resetLabel?: string;
  children: React.ReactNode;
}

export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  onClose,
  onApply,
  onReset,
  title = "Filter",
  applyLabel = "Apply Filters",
  resetLabel = "Reset",
  children,
}) => {
  const insets = useSafeAreaInsets();
  const bottomPadding = Math.max(insets.bottom, 16);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close filter"
        />

        <View
          style={[styles.sheet, { paddingBottom: bottomPadding }]}
          accessibilityViewIsModal={true}
          accessibilityLabel={title}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header" allowFontScaling>
              {title}
            </Text>
            {onReset ? (
              <Pressable
                onPress={onReset}
                accessibilityRole="button"
                accessibilityLabel="Reset all filters"
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.resetBtn}
              >
                <Text style={styles.resetText} allowFontScaling>
                  {resetLabel}
                </Text>
              </Pressable>
            ) : null}
          </View>
          <Divider />

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>

          {/* Footer */}
          <Divider />
          <View style={styles.footer}>
            <Button
              title={applyLabel}
              onPress={onApply}
              fullWidth
              variant="primary"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    maxHeight: "85%",
    elevation: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  title: {
    ...fontStyles.subheading,
    fontWeight: "700",
    color: colors.neutral[950],
  },
  resetBtn: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  resetText: {
    ...fontStyles.captionMedium,
    color: colors.brand[700],
    fontWeight: "600",
  },
  body: {
    maxHeight: 400,
  },
  bodyContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
});
