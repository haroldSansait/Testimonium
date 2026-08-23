import React from "react";
import { useLocalSearchParams } from "expo-router";
import { RequestDetailScreen } from "@/features/requests/RequestDetailScreen";

export default function RequestDetailRoute() {
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  return <RequestDetailScreen requestId={requestId} />;
}
