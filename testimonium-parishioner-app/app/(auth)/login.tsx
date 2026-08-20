import { router } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "@/components/Screen";
import { Button } from "@/components/ui/Button";
import { TextInput } from "@/components/ui/TextInput";
import { useAuth } from "@/providers/AuthProvider";
import { isAppError } from "@/services/api/errors";
import { colors, spacing, typography } from "@/theme/tokens";

export default function LoginScreen() {
  const { signInWithEmail, isSigningIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    try { await signInWithEmail(email, password); } catch (cause) { setError(isAppError(cause) ? cause.message : "We could not sign you in. Please try again."); }
  };
  return <Screen style={styles.screen}><Text style={styles.title}>Sign in</Text><Text style={styles.copy}>Use your existing TESTIMONIUM account.</Text><View style={styles.fields}><TextInput label="Email address" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" /><TextInput label="Password" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" /></View>{error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}<Button title={isSigningIn ? "Signing in…" : "Sign in"} disabled={isSigningIn || !email || !password} onPress={() => { void submit(); }} /><Button title="Back" onPress={() => router.back()} /></Screen>;
}
const styles = StyleSheet.create({ screen: { justifyContent: "center", gap: spacing.md }, title: { color: colors.textPrimary, fontSize: typography.title, fontWeight: "700" }, copy: { color: colors.textSecondary, fontSize: typography.body }, fields: { gap: spacing.md, marginVertical: spacing.md }, error: { color: colors.danger, fontSize: 14 } });