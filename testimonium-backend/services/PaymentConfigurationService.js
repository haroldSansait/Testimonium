import { PaymentConfigurationRepository } from "../repositories/PaymentConfigurationRepository.js";

export class PaymentConfigurationService {
  constructor(paymentConfigurationRepository = new PaymentConfigurationRepository()) {
    this.paymentConfigurationRepository = paymentConfigurationRepository;
  }

  /**
   * Resolves the one authoritative generic payment QR for an owned request.
   * The parish is derived only from that request, so a client cannot substitute
   * another parish ID to retrieve its payment configuration.
   */
  async getConfiguration({ requestId, userId } = {}) {
    if (!/^[1-9]\d*$/.test(String(requestId ?? "").trim())) {
      const error = new Error("A valid request ID is required.");
      error.statusCode = 400;
      throw error;
    }

    if (!/^[1-9]\d*$/.test(String(userId ?? "").trim())) {
      const error = new Error("Authentication is required.");
      error.statusCode = 401;
      throw error;
    }

    const request = await this.paymentConfigurationRepository.findOwnedRequestById(requestId, userId);
    if (!request) {
      const error = new Error("Request not found or unauthorized.");
      error.statusCode = 404;
      throw error;
    }

    const parish = await this.paymentConfigurationRepository.findByParishId(request.parishId);
    const imageUrl = this.getValidImageUrl(parish?.paymentQrImage);
    const enabled = Boolean(parish?.paymentQrEnabled);
    const configured = Boolean(enabled && imageUrl);

    return {
      configured,
      qrCode: {
        enabled,
        imageUrl: configured ? imageUrl : null,
      },
      ...(!configured && {
        message: "Online payment details are not yet configured for this parish.",
      }),
    };
  }

  getValidImageUrl(value) {
    if (typeof value !== "string" || !value.trim()) return null;

    try {
      const url = new URL(value.trim());
      return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
    } catch {
      return null;
    }
  }
}
