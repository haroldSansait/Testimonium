import React, { createRef } from "react";
import { Platform, StyleSheet, Text as NativeText, TextInput as NativeTextInput } from "react-native";
import { cleanup, fireEvent, render } from "@testing-library/react-native";
import { Text, TextInput } from "@/components/Typography";
import { fontStyles } from "@/theme/tokens";

afterEach(cleanup);

it("gives unstyled Android UI text Inter without changing font scaling", async () => {
  const screen = await render(<Text testID="label">Label</Text>);
  const label = screen.getByTestId("label");
  expect(StyleSheet.flatten(label.props.style).fontFamily).toBe(Platform.OS === "android" ? "Inter" : undefined);
  expect(label.props.allowFontScaling).not.toBe(false);
});

it("preserves caller typography metrics and serif heading overrides", async () => {
  const style = { ...fontStyles.titleSerif, fontSize: 22, fontWeight: "800" as const, letterSpacing: 0.8, color: "#7B1C2A" };
  const screen = await render(<Text testID="heading" style={style} maxFontSizeMultiplier={2}>Heading</Text>);
  const heading = screen.getByTestId("heading");
  expect(fontStyles.titleSerif.fontFamily).toBe(Platform.OS === "android" ? "Playfair Display" : "serif");
  expect(StyleSheet.flatten(heading.props.style)).toEqual(style);
  expect(heading.props.maxFontSizeMultiplier).toBe(2);
});

it("lets nested text inherit its parent family and keeps explicit code fonts", async () => {
  const screen = await render(
    <Text style={fontStyles.titleSerif}>
      Heading <Text testID="nested" style={{ fontWeight: "800" }}>emphasis</Text>
      <Text testID="code" style={{ fontFamily: "monospace" }}>code</Text>
    </Text>
  );
  expect(StyleSheet.flatten(screen.getByTestId("nested").props.style).fontFamily).toBeUndefined();
  expect(StyleSheet.flatten(screen.getByTestId("code").props.style).fontFamily).toBe("monospace");
});

it("preserves input events, refs, font weight and accessibility props", async () => {
  const ref = createRef<NativeTextInput>();
  const onChangeText = jest.fn();
  const screen = await render(
    <TextInput ref={ref} testID="input" accessibilityLabel="Code" keyboardType="number-pad"
      allowFontScaling maxFontSizeMultiplier={1.5} style={{ fontSize: 16, fontWeight: "600" }} onChangeText={onChangeText} />
  );
  const input = screen.getByTestId("input");
  expect(StyleSheet.flatten(input.props.style)).toEqual({
    ...(Platform.OS === "android" ? { fontFamily: "Inter" } : {}),
    fontSize: 16,
    fontWeight: "600",
  });
  expect(input.props.allowFontScaling).toBe(true);
  expect(input.props.maxFontSizeMultiplier).toBe(1.5);
  expect(input.props.keyboardType).toBe("number-pad");
  expect(ref.current).toBeTruthy();
  fireEvent.changeText(input, "123456");
  expect(onChangeText).toHaveBeenCalledWith("123456");
});

it("keeps native text refs available", async () => {
  const ref = createRef<NativeText>();
  await render(<Text ref={ref}>Label</Text>);
  expect(ref.current).toBeTruthy();
});
