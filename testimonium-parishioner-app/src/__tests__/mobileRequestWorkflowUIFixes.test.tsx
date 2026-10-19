import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Text } from "react-native";
import { SafeBottomActionBar } from "@/components/ui/SafeBottomActionBar";
import { ReceiptCapturePicker } from "@/features/requests/components/ReceiptCapturePicker";

const createWrapper = () => {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <SafeAreaProvider
      initialMetrics={{
        frame: { x: 0, y: 0, width: 390, height: 844 },
        insets: { top: 47, left: 0, right: 0, bottom: 24 },
      }}
    >
      {children}
    </SafeAreaProvider>
  );
  Wrapper.displayName = "TestWrapper";
  return Wrapper;
};

describe("Mobile Request Workflow UI Fixes", () => {
  describe("SafeBottomActionBar", () => {
    it("renders children with safe-area padding and additional breathing room", async () => {
      await render(
        <SafeBottomActionBar>
          <Text>Action Button</Text>
        </SafeBottomActionBar>,
        { wrapper: createWrapper() }
      );

      expect(screen.getByText("Action Button")).toBeTruthy();
    });
  });

  describe("ReceiptCapturePicker Media Buttons", () => {
    it("renders Choose from Gallery and Take Photo buttons with accessible labels", async () => {
      const onSelect = jest.fn();
      const onRemove = jest.fn();

      await render(
        <ReceiptCapturePicker
          receipt={null}
          onReceiptSelected={onSelect}
          onReceiptRemoved={onRemove}
        />,
        { wrapper: createWrapper() }
      );

      expect(screen.getByLabelText("Choose receipt from photo gallery")).toBeTruthy();
      expect(screen.getByLabelText("Take a photo of receipt using camera")).toBeTruthy();
      expect(screen.getByText("Choose from Gallery")).toBeTruthy();
      expect(screen.getByText("Take Photo")).toBeTruthy();
    });
  });
});
