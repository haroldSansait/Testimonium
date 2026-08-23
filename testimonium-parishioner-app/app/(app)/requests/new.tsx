import React from "react";
import { useLocalSearchParams } from "expo-router";
import { RequestWizardScreen } from "@/features/requests/RequestWizardScreen";

export default function NewRequestRoute() {
  const { parishId } = useLocalSearchParams<{ parishId?: string }>();
  return <RequestWizardScreen initialParishId={parishId} />;
}
