import { useState, useCallback } from "react";
import { LayoutChangeEvent, Platform, useWindowDimensions } from "react-native";
import { useSafeAreaInsets, type EdgeInsets } from "react-native-safe-area-context";
import { getPageGutter, isNarrowScreen, isTabletScreen, MAX_READABLE_WIDTH } from "@/theme/responsive";

export interface AppLayoutMetrics {
  width: number;
  height: number;
  insets: EdgeInsets;
  pageGutter: number;
  tabBarHeight: number;
  bottomActionHeight: number;
  contentBottomInset: (mode?: "tab" | "action" | "none") => number;
  isNarrow: boolean;
  isTablet: boolean;
  maxReadableWidth: number;
  onBottomActionLayout: (event: LayoutChangeEvent) => void;
}

export function useAppLayoutMetrics(): AppLayoutMetrics {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [bottomActionHeight, setBottomActionHeight] = useState<number>(0);

  const pageGutter = getPageGutter(width);
  const isNarrow = isNarrowScreen(width);
  const isTablet = isTabletScreen(width);

  // Tab bar base height: 56dp + safe area bottom
  const platformBottomMin = Platform.OS === "android" ? 8 : 12;
  const safeBottom = Math.max(insets.bottom, platformBottomMin);
  const tabBarHeight = 56 + safeBottom;

  const onBottomActionLayout = useCallback((event: LayoutChangeEvent) => {
    const layoutHeight = event.nativeEvent.layout.height;
    if (layoutHeight > 0) {
      setBottomActionHeight(layoutHeight);
    }
  }, []);

  const contentBottomInset = useCallback(
    (mode: "tab" | "action" | "none" = "none"): number => {
      if (mode === "tab") {
        return tabBarHeight + 16;
      }
      if (mode === "action") {
        return (bottomActionHeight > 0 ? bottomActionHeight : 72 + safeBottom) + 16;
      }
      return safeBottom + 16;
    },
    [tabBarHeight, bottomActionHeight, safeBottom]
  );

  return {
    width,
    height,
    insets,
    pageGutter,
    tabBarHeight,
    bottomActionHeight,
    contentBottomInset,
    isNarrow,
    isTablet,
    maxReadableWidth: MAX_READABLE_WIDTH.content,
    onBottomActionLayout,
  };
}
