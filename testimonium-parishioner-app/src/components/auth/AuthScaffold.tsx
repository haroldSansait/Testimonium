import React from "react";
import {
  KeyboardAvoidingView,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, spacing } from "@/theme/tokens";
import { ContentColumn } from "../layout/ContentColumn";
import { AuthBrandHero } from "./AuthBrandHero";

export interface AuthScaffoldProps {
  title?: string;
  subtitle?: string;
  compactHero?: boolean;
  children: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  keyboardVerticalOffset?: number;
}

export const AuthScaffold: React.FC<AuthScaffoldProps> = ({
  title,
  subtitle,
  compactHero = false,
  children,
  contentContainerStyle,
  keyboardVerticalOffset = 0,
}) => {
  return (
    <SafeAreaView edges={["left", "right"]} style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Top Brand Masthead */}
          <AuthBrandHero
            title={title}
            subtitle={subtitle}
            compact={compactHero}
          />

          {/* White Form Canvas */}
          <View style={styles.formCanvas}>
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
    backgroundColor: colors.canvas,
  },
  scrollContent: {
    flexGrow: 1,
  },
  formCanvas: {
    flex: 1,
    backgroundColor: colors.canvas,
    paddingVertical: spacing.lg,
  },
});
