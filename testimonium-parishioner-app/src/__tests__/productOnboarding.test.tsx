import React from "react";
import { Text } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { render, fireEvent, cleanup, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  PRODUCT_INTRO_STORAGE_KEY,
  hasCompletedProductIntro,
  markProductIntroCompleted,
  resetProductIntro,
} from "@/services/onboarding/productOnboardingStorage";
import ProductOnboardingScreen from "../../app/(product-onboarding)/index";
import {
  ProductIntroProvider,
  useProductIntro,
} from "@/providers/ProductIntroProvider";

const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();
const mockRouterBack = jest.fn();
let mockSearchParams: { preview?: string } = {};

jest.mock("expo-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    back: mockRouterBack,
  }),
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("@expo/vector-icons", () => ({
  Ionicons: "Ionicons",
}));

afterEach(async () => {
  cleanup();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockSearchParams = {};
});

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 44, left: 0, right: 0, bottom: 34 },
};

const IntroCompletionProbe = () => {
  const { introCompleted } = useProductIntro();
  return <Text>{String(introCompleted)}</Text>;
};

describe("Product Onboarding - Phase B", () => {
  describe("Storage and Persistence", () => {
    it("returns false for fresh device", async () => {
      const completed = await hasCompletedProductIntro();
      expect(completed).toBe(false);
    });

    it("marks intro as completed and persists across reads", async () => {
      await markProductIntroCompleted();
      const stored = await AsyncStorage.getItem(PRODUCT_INTRO_STORAGE_KEY);
      expect(stored).toBe("true");

      const completed = await hasCompletedProductIntro();
      expect(completed).toBe(true);
    });

    it("resets intro properly", async () => {
      await markProductIntroCompleted();
      await resetProductIntro();
      const completed = await hasCompletedProductIntro();
      expect(completed).toBe(false);
    });

    it("rehydrates completed device-scoped state after the provider remounts", async () => {
      await markProductIntroCompleted();

      const view = await render(
        <ProductIntroProvider>
          <IntroCompletionProbe />
        </ProductIntroProvider>
      );

      expect(await view.findByText("true")).toBeTruthy();
    });
  });

  describe("Onboarding Screen UI Flow", () => {
    it("renders page 1 content, navigates through pages, and completes", async () => {
      const onCompleted = jest.fn();
      const { findByText } = await render(
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <ProductIntroProvider>
            <ProductOnboardingScreen onCompleted={onCompleted} />
          </ProductIntroProvider>
        </SafeAreaProvider>
      );

      // Page 1: Sacramental Records
      expect(await findByText("Sacramental Records")).toBeTruthy();
      const nextBtn1 = await findByText("Next");
      fireEvent.press(nextBtn1);

      // Page 2: Parish Life & Services
      expect(await findByText("Parish Life & Services")).toBeTruthy();
      const nextBtn2 = await findByText("Next");
      fireEvent.press(nextBtn2);

      // Page 3: Caloy Parish Guide
      expect(await findByText("Caloy Parish Guide")).toBeTruthy();
      const getStartedBtn = await findByText("Get Started");
      fireEvent.press(getStartedBtn);

      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledTimes(1);
      });

      const completed = await hasCompletedProductIntro();
      expect(completed).toBe(true);

    });

    it("skips onboarding immediately when Skip is pressed", async () => {
      const onCompleted = jest.fn();
      const { findByText } = await render(
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <ProductIntroProvider>
            <ProductOnboardingScreen onCompleted={onCompleted} />
          </ProductIntroProvider>
        </SafeAreaProvider>
      );

      const skipBtn = await findByText("Skip");
      fireEvent.press(skipBtn);

      await waitFor(() => {
        expect(onCompleted).toHaveBeenCalledTimes(1);
      });

      const completed = await hasCompletedProductIntro();
      expect(completed).toBe(true);
    });

    it("supports preview mode without changing the completed storage key", async () => {
      mockSearchParams = { preview: "true" };
      await markProductIntroCompleted();

      const { findByText } = await render(
        <SafeAreaProvider initialMetrics={initialMetrics}>
          <ProductIntroProvider>
            <ProductOnboardingScreen />
          </ProductIntroProvider>
        </SafeAreaProvider>
      );

      const closeBtn = await findByText("Close");
      fireEvent.press(closeBtn);

      await waitFor(() => {
        expect(mockRouterBack).toHaveBeenCalledTimes(1);
      });

      const completed = await hasCompletedProductIntro();
      expect(completed).toBe(true);
    });
  });
});
