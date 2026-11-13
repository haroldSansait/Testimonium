import React from "react";
import { useLocalSearchParams } from "expo-router";
import { RequestWizardScreen } from "@/features/requests/RequestWizardScreen";

export default function NewRequestRoute() {
  const { parishId, draftId } = useLocalSearchParams<{
    parishId?: string;
    draftId?: string;
  }>();
  return <RequestWizardScreen initialParishId={parishId} draftId={draftId} />;
}
