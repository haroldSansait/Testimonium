import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, shadows, spacing } from "@/theme/tokens";
import { ContentColumn } from "../layout/ContentColumn";
import { AuthBrandHero } from "./AuthBrandHero";

export interface AuthScaffoldProps {
  title?: string;
  subtitle?: string;
  compactHero?: boolean;
  heroMinHeight?: number;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
  onBack?: () => void;
  showBack?: boolean;
  roundedSurface?: boolean;
}

export const AuthScaffold: React.FC<AuthScaffoldProps> = ({
  title,
  subtitle,
  compactHero = false,
  heroMinHeight,
  children,
  contentContainerStyle,
  keyboardVerticalOffset = Platform.OS === "ios" ? 64 : 0,
  onBack,
  showBack = false,
  roundedSurface = true,
}) => {
  return (
    <SafeAreaView edges={["left", "right"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Brand Masthead with Mt. Kanlaon background */}
          <AuthBrandHero
            title={title}
            subtitle={subtitle}
            compact={compactHero}
            heroMinHeight={heroMinHeight}
            onBack={onBack}
            showBack={showBack}
          />

          {/* White Form Canvas with rounded sheet surface */}
          <View
            style={[
              styles.formCanvas,
              roundedSurface ? styles.roundedCanvas : null,
            ]}
          >
            <ContentColumn maxWidth={520}>
              {children}
            </ContentColumn>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#5C1520", // Matches hero background to prevent white flashes at top
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.canvas,
  },
  formCanvas: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
  },
  roundedCanvas: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    backgroundColor: colors.canvas,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    ...shadows.sm,
  },
});
