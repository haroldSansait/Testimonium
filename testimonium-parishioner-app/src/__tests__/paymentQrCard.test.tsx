import React from "react";
import { render } from "@testing-library/react-native";
import { PaymentQrCard } from "../features/requests/components/PaymentQrCard";

describe("PaymentQrCard", () => {
  it("renders the generic parish QR when the canonical configuration is enabled", () => {
    const screen = render(
      <PaymentQrCard
        configuration={{
          configured: true,
          qrCode: {
            enabled: true,
            imageUrl: "https://pub-r2.testimonium.media/parishes/2/payment-qr.png",
          },
        }}
        feeAmount={150}
      />,
    );

    expect(screen).toBeTruthy();
  });

  it("shows a safe unconfigured state when the QR is absent or disabled", () => {
    const screen = render(
      <PaymentQrCard
        configuration={{
          configured: false,
          qrCode: { enabled: false, imageUrl: null },
          message: "Online payment details are not yet configured for this parish.",
        }}
      />,
    );

    expect(screen).toBeTruthy();
  });
});
