import React from "react";
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
  type ViewProps,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { colors } from "@/theme/tokens";
import { ContentColumn } from "./ContentColumn";
import { useAppLayoutMetrics } from "./useAppLayoutMetrics";

export type ScreenScaffoldVariant =
  | "scroll"
  | "static"
  | "list"
  | "form"
  | "immersiveHero";

export interface ScreenScaffoldProps extends ViewProps {
  variant?: ScreenScaffoldVariant;
  bottomMode?: "tab" | "action" | "none";
  safeEdges?: Edge[];
  useGutter?: boolean;
  maxWidth?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  keyboardVerticalOffset?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  header?: React.ReactNode;
  footer?: React.ReactNode;
}

export const ScreenScaffold: React.FC<ScreenScaffoldProps> = ({
  children,
  variant = "scroll",
  bottomMode = "none",
  safeEdges,
  useGutter = true,
  maxWidth,
  style,
  contentContainerStyle,
  keyboardAvoiding = true,
  keyboardVerticalOffset = 0,
  refreshing = false,
  onRefresh,
  header,
  footer,
  ...props
}) => {
  const { contentBottomInset } = useAppLayoutMetrics();
  const bottomInset = contentBottomInset(bottomMode);

  // Default safe edges based on variant
  const defaultEdges: Edge[] =
    variant === "immersiveHero"
      ? ["left", "right"]
      : safeEdges ?? ["top", "left", "right"];

  const refreshControl = onRefresh ? (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={colors.primary}
      colors={[colors.primary]}
    />
  ) : undefined;

  const renderContent = () => {
    if (variant === "scroll" || variant === "form") {
      const scrollContent = (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomInset },
            contentContainerStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          <ContentColumn maxWidth={maxWidth} useGutter={useGutter}>
            {children}
          </ContentColumn>
        </ScrollView>
      );

      if (keyboardAvoiding) {
        return (
          <KeyboardAvoidingView
            style={styles.flex}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            {scrollContent}
          </KeyboardAvoidingView>
        );
      }

      return scrollContent;
    }

    if (variant === "list") {
      return (
        <View
          style={[
            styles.flex,
            { paddingBottom: bottomMode === "tab" || bottomMode === "action" ? bottomInset : 0 },
            style,
          ]}
        >
          {children}
        </View>
      );
    }

    // Static or immersiveHero
    const staticBody = (
      <View
        style={[
          styles.flex,
          { paddingBottom: bottomInset },
          contentContainerStyle,
        ]}
      >
        <ContentColumn maxWidth={maxWidth} useGutter={useGutter} style={styles.flex}>
          {children}
        </ContentColumn>
      </View>
    );

    if (keyboardAvoiding) {
      return (
        <KeyboardAvoidingView
          style={styles.flex}
          keyboardVerticalOffset={keyboardVerticalOffset}
        >
          {staticBody}
        </KeyboardAvoidingView>
      );
    }

    return staticBody;
  };

  return (
    <SafeAreaView edges={defaultEdges} style={[styles.canvas, style]} {...props}>
      {header}
      {renderContent()}
      {footer}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  canvas: {
    flex: 1,
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
  },
});
