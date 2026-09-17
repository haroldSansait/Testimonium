import React from "react";
import { Text } from "react-native";
import { render } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ScreenScaffold, ContentColumn } from "@/components/layout";

describe("ScreenScaffold and Layout System", () => {
  const initialMetrics = {
    frame: { x: 0, y: 0, width: 390, height: 844 },
    insets: { top: 47, left: 0, right: 0, bottom: 34 },
  };

  it("renders ScreenScaffold in scroll mode with safe area padding", async () => {
    const { findByText } = await render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ScreenScaffold variant="scroll" bottomMode="tab">
          <Text>Scaffold Content</Text>
        </ScreenScaffold>
      </SafeAreaProvider>
    );

    expect(await findByText("Scaffold Content")).toBeTruthy();
  });

  it("renders ScreenScaffold in static mode", async () => {
    const { findByText } = await render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ScreenScaffold variant="static">
          <Text>Static Content</Text>
        </ScreenScaffold>
      </SafeAreaProvider>
    );

    expect(await findByText("Static Content")).toBeTruthy();
  });

  it("renders ContentColumn with max readable width and gutter", async () => {
    const { findByText } = await render(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <ContentColumn>
          <Text>Column Content</Text>
        </ContentColumn>
      </SafeAreaProvider>
    );

    expect(await findByText("Column Content")).toBeTruthy();
  });
});
