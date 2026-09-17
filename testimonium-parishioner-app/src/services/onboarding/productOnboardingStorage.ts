import AsyncStorage from "@react-native-async-storage/async-storage";

export const PRODUCT_INTRO_STORAGE_KEY = "testimonium_product_intro_v1";

/**
 * Checks whether the user has previously completed or skipped the first-launch product onboarding.
 * Device-scoped (not UID-scoped) and intentionally survives user logout.
 */
export async function hasCompletedProductIntro(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(PRODUCT_INTRO_STORAGE_KEY);
    return value === "true";
  } catch {
    // Fail open if storage read fails, so users are not trapped
    return true;
  }
}

/**
 * Marks the product onboarding as completed on this device.
 */
export async function markProductIntroCompleted(): Promise<void> {
  try {
    await AsyncStorage.setItem(PRODUCT_INTRO_STORAGE_KEY, "true");
  } catch {
    // Non-blocking: allow session to continue even if write fails
  }
}

/**
 * Resets the product intro completion (useful for testing).
 */
export async function resetProductIntro(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PRODUCT_INTRO_STORAGE_KEY);
  } catch {
    // Non-blocking
  }
}
