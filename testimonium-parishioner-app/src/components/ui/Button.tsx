import { Pressable, StyleSheet, Text, type PressableProps } from "react-native";
import { colors, radii, spacing } from "@/theme/tokens";

export const Button = ({ title, disabled, style, ...props }: PressableProps & { title: string }) => (
  <Pressable accessibilityRole="button" disabled={disabled} style={(state) => [styles.button, (state.pressed || disabled) && styles.pressed, typeof style === "function" ? style(state) : style]} {...props}>
    <Text style={styles.label}>{title}</Text>
  </Pressable>
);
const styles = StyleSheet.create({ button: { minHeight: 44, alignItems: "center", justifyContent: "center", backgroundColor: colors.primary, paddingHorizontal: spacing.md, borderRadius: radii.md }, pressed: { opacity: 0.72 }, label: { color: colors.surface, fontSize: 16, fontWeight: "700" } });