import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export const useReducedMotion = (): boolean => {
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;

    void AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(Boolean(enabled));
      })
      .catch(() => {});

    const subscription = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (enabled) => {
        if (active) setReduceMotion(Boolean(enabled));
      }
    );

    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return reduceMotion;
};
