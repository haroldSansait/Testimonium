import { StyleSheet, Text, TextInput as NativeTextInput, type TextInputProps, View } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export const TextInput = ({ label, ...props }: TextInputProps & { label: string }) => <View style={styles.group}><Text style={styles.label}>{label}</Text><NativeTextInput accessibilityLabel={label} style={styles.input} placeholderTextColor={colors.textSecondary} {...props} /></View>;
const styles = StyleSheet.create({ group: { gap: spacing.xs }, label: { fontSize: 14, color: colors.textPrimary, fontWeight: "600" }, input: { minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, backgroundColor: colors.surface, color: colors.textPrimary, paddingHorizontal: spacing.md, fontSize: 16 } });