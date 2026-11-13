import { createContext, forwardRef, useContext } from "react";
import {
  Platform,
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
} from "react-native";
import { sansFamily } from "@/theme/tokens";

const InsideText = createContext(false);
const styles = StyleSheet.create({
  // The fonts are embedded in Android builds; other platforms keep their defaults.
  body: Platform.OS === "android" ? { fontFamily: sansFamily } : {},
});

// Native instance aliases keep existing ref types compatible with these wrappers.
export type Text = NativeText;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const Text = forwardRef<NativeText, TextProps>(function Text({ style, ...props }, ref) {
  const nested = useContext(InsideText);
  return (
    <InsideText.Provider value={true}>
      <NativeText {...props} ref={ref} style={[!nested && styles.body, style]} />
    </InsideText.Provider>
  );
});

export type TextInput = NativeTextInput;
// eslint-disable-next-line @typescript-eslint/no-redeclare
export const TextInput = forwardRef<NativeTextInput, TextInputProps>(function TextInput({ style, ...props }, ref) {
  return <NativeTextInput {...props} ref={ref} style={[styles.body, style]} />;
});
