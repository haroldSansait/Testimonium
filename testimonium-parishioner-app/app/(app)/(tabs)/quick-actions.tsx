import React from "react";
import { View } from "react-native";

// Internal placeholder for the Center Action Button trigger.
// Intercepted via tabPress (e.preventDefault()) so it is never navigated to.
export default function QuickActionsPlaceholder() {
  return <View testID="quick-actions-placeholder" />;
}
