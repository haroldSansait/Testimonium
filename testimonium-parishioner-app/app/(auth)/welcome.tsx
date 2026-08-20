import { Link, router } from "expo-router";
import { StyleSheet, Text } from "react-native";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/Screen";
import { useAuth } from "@/providers/AuthProvider";
import { colors, spacing, typography } from "@/theme/tokens";

export default function WelcomeScreen() {
  const { state, error, refreshProfile, logout } = useAuth();
  if (state === "SESSION_ERROR") return <Screen style={styles.container}><Text style={styles.title}>Session needs attention</Text><Text style={styles.copy}>{error}</Text><Button title="Retry session" onPress={() => { void refreshProfile(); }} /><Button title="Sign out" onPress={() => { void logout(); }} /></Screen>;
  return <Screen style={styles.container}><Text style={styles.title}>TESTIMONIUM</Text><Text style={styles.copy}>Sacramental document services for the Diocese of San Carlos.</Text><Button title="Sign in" onPress={() => router.push("/(auth)/login")} /><Link href="/(auth)/login" style={styles.link}>Use an existing account</Link></Screen>;
}
const styles = StyleSheet.create({ container: { justifyContent: "center", gap: spacing.lg }, title: { color: colors.primary, fontSize: typography.title, fontWeight: "700" }, copy: { color: colors.textSecondary, fontSize: typography.body, lineHeight: 24 }, link: { color: colors.primary, textAlign: "center", fontWeight: "600" } });