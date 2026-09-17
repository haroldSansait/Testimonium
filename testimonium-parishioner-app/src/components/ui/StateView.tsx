import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fontStyles, spacing } from "@/theme/tokens";
import { Button } from "./Button";

export interface StateViewEmptyProps {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}

export interface StateViewInlineErrorProps {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  style?: StyleProp<ViewStyle>;
}

export interface StateViewFullErrorProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onBack?: () => void;
  style?: StyleProp<ViewStyle>;
}

export interface StateViewLoadingProps {
  label?: string;
  style?: StyleProp<ViewStyle>;
}

export interface StateViewOfflineProps {
  message?: string;
  style?: StyleProp<ViewStyle>;
}

export const StateView = {
  Empty: ({
    icon = "folder-open-outline",
    title,
    description,
    actionLabel,
    onAction,
    style,
  }: StateViewEmptyProps) => {
    return (
      <View
        style={[styles.emptyContainer, style]}
        accessible={true}
        accessibilityRole="summary"
      >
        <Ionicons
          name={icon}
          size={36}
          color={colors.neutral[500]}
          style={styles.emptyIcon}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text style={styles.emptyTitle} allowFontScaling>
          {title}
        </Text>
        {description ? (
          <Text style={styles.emptyDesc} allowFontScaling>
            {description}
          </Text>
        ) : null}
        {actionLabel && onAction ? (
          <Pressable
            onPress={onAction}
            accessibilityRole="button"
            accessibilityLabel={actionLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.emptyAction}
          >
            <Text style={styles.emptyActionText} allowFontScaling>
              {actionLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  },

  InlineError: ({
    message,
    onRetry,
    retryLabel = "Try Again",
    style,
  }: StateViewInlineErrorProps) => {
    return (
      <View
        style={[styles.inlineErrorContainer, style]}
        accessible={true}
        accessibilityRole="alert"
      >
        <Ionicons
          name="alert-circle-outline"
          size={18}
          color={colors.danger}
          style={styles.inlineErrorIcon}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text style={styles.inlineErrorText} allowFontScaling>
          {message}
        </Text>
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            accessibilityRole="button"
            accessibilityLabel={retryLabel}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.inlineErrorRetry}
          >
            <Text style={styles.inlineErrorRetryText} allowFontScaling>
              {retryLabel}
            </Text>
          </Pressable>
        ) : null}
      </View>
    );
  },

  FullError: ({
    title = "Something went wrong",
    message,
    onRetry,
    retryLabel = "Try Again",
    onBack,
    style,
  }: StateViewFullErrorProps) => {
    return (
      <View
        style={[styles.fullErrorContainer, style]}
        accessible={true}
        accessibilityRole="alert"
      >
        <Ionicons
          name="alert-circle-outline"
          size={44}
          color={colors.danger}
          style={styles.fullErrorIcon}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text style={styles.fullErrorTitle} accessibilityRole="header" allowFontScaling>
          {title}
        </Text>
        <Text style={styles.fullErrorDesc} allowFontScaling>
          {message}
        </Text>
        <View style={styles.fullErrorActions}>
          {onRetry ? (
            <Button
              title={retryLabel}
              onPress={onRetry}
              variant="primary"
            />
          ) : null}
          {onBack ? (
            <Button
              title="Go Back"
              onPress={onBack}
              variant="ghost"
            />
          ) : null}
        </View>
      </View>
    );
  },

  Loading: ({ label = "Loading\u2026", style }: StateViewLoadingProps) => {
    return (
      <View
        style={[styles.loadingContainer, style]}
        accessible={true}
        accessibilityRole="progressbar"
        accessibilityLabel={label}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        {label ? (
          <Text style={styles.loadingText} allowFontScaling>
            {label}
          </Text>
        ) : null}
      </View>
    );
  },

  Offline: ({
    message = "Offline — showing saved results",
    style,
  }: StateViewOfflineProps) => {
    return (
      <View
        style={[styles.offlineBanner, style]}
        accessible={true}
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={message}
      >
        <Ionicons
          name="cloud-offline-outline"
          size={14}
          color={colors.neutral[650]}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        />
        <Text style={styles.offlineText} allowFontScaling>
          {message}
        </Text>
      </View>
    );
  },
};

const styles = StyleSheet.create({
  emptyContainer: {
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIcon: {
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    ...fontStyles.subheading,
    fontWeight: "600",
    color: colors.neutral[950],
    textAlign: "center",
  },
  emptyDesc: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
    textAlign: "center",
    marginTop: spacing.xs,
    maxWidth: 280,
  },
  emptyAction: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  emptyActionText: {
    ...fontStyles.button,
    color: colors.brand[700],
  },

  inlineErrorContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: colors.danger,
    backgroundColor: colors.surface,
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  inlineErrorIcon: {
    marginRight: 2,
  },
  inlineErrorText: {
    ...fontStyles.bodySmall,
    color: colors.danger,
    flex: 1,
  },
  inlineErrorRetry: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xs,
  },
  inlineErrorRetryText: {
    ...fontStyles.captionMedium,
    color: colors.brand[700],
    fontWeight: "600",
  },

  fullErrorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xxl,
  },
  fullErrorIcon: {
    marginBottom: spacing.md,
  },
  fullErrorTitle: {
    ...fontStyles.heading,
    fontWeight: "700",
    color: colors.neutral[950],
    textAlign: "center",
  },
  fullErrorDesc: {
    ...fontStyles.body,
    color: colors.neutral[650],
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
    maxWidth: 320,
  },
  fullErrorActions: {
    gap: spacing.sm,
    width: "100%",
    maxWidth: 260,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    ...fontStyles.bodySmall,
    color: colors.neutral[650],
  },

  offlineBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.neutral[50],
    borderBottomWidth: 1,
    borderBottomColor: colors.neutral[200],
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  offlineText: {
    ...fontStyles.caption,
    color: colors.neutral[650],
  },
});
