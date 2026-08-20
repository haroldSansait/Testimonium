import { ActivityIndicator, StyleSheet, Text, View, type ViewProps } from "react-native";
import { colors, spacing } from "@/theme/tokens";

export const Screen = ({ children, style, ...props }: ViewProps) => <View style={[styles.screen, style]} {...props}>{children}</View>;
export const LoadingState = ({ label = "Loading…" }: { label?: string }) => <Screen style={styles.center}><ActivityIndicator color={colors.primary} size="large" /><Text style={styles.label}>{label}</Text></Screen>;
export const ErrorState = ({ message }: { message: string }) => <Screen style={styles.center}><Text accessibilityRole="alert" style={styles.error}>{message}</Text></Screen>;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, padding: spacing.md },
  center: { justifyContent: "center", alignItems: "center", gap: spacing.md },
  label: { color: colors.textSecondary, fontSize: 16 },
  error: { color: colors.danger, textAlign: "center", fontSize: 16 },
});