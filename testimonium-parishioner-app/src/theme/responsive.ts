import { Dimensions } from "react-native";

export const BREAKPOINTS = {
  narrow: 360,
  medium: 412,
  tablet: 768,
} as const;

export const MAX_READABLE_WIDTH = {
  form: 640,
  content: 640,
  media: 720,
} as const;

export function getPageGutter(width: number): number {
  if (width < BREAKPOINTS.narrow) {
    return 16;
  }
  if (width < BREAKPOINTS.medium) {
    return 20;
  }
  return 24;
}

export function isNarrowScreen(width?: number): boolean {
  const screenWidth = width ?? Dimensions.get("window").width;
  return screenWidth < BREAKPOINTS.narrow;
}

export function isTabletScreen(width?: number): boolean {
  const screenWidth = width ?? Dimensions.get("window").width;
  return screenWidth >= BREAKPOINTS.tablet;
}

export const MIN_TOUCH_TARGET = 44;
