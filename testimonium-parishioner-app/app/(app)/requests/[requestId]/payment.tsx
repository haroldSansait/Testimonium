import React from "react";
import { useLocalSearchParams } from "expo-router";
import { PaymentScreen } from "@/features/requests/PaymentScreen";

export default function RequestPaymentRoute() {
  const { requestId } = useLocalSearchParams<{ requestId?: string }>();
  return <PaymentScreen requestId={requestId} />;
}
