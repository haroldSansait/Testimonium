import { logger } from "../config/logger.js";
import { PaymentConfigurationRepository } from "../repositories/PaymentConfigurationRepository.js";

export class PaymentConfigurationService {
  constructor(paymentConfigurationRepository = new PaymentConfigurationRepository()) {
    this.paymentConfigurationRepository = paymentConfigurationRepository;
  }

  /**
   * Resolves the payment configuration. Falls back to default if parish not found.
   * @param {number|string|undefined} parishId
   */
  async resolveConfiguration(parishId) {
    let parish = null;
    if (parishId) {
      parish = await this.paymentConfigurationRepository.findByParishId(parishId);
    }

    let mayaEnabled = false;
    if (parish && parish.documentSettings) {
      try {
        const settings = JSON.parse(parish.documentSettings);
        if (settings.paymentMethods && settings.paymentMethods.maya !== undefined) {
          mayaEnabled = !!settings.paymentMethods.maya;
        }
      } catch (e) {
        logger.error({ err: e }, "Error parsing settings for payment config");
      }
    }

    if (parish) {
      return {
        gcash: {
          accountName: `${parish.parishName} Sacramental Fees`,
          accountNumber: parish.contactNumber || "0917-111-2222",
          qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/gcash_qr.png"
        },
        maya: mayaEnabled ? {
          accountName: `${parish.parishName} Maya Registry`,
          accountNumber: parish.contactNumber || "0917-111-2222",
          qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/maya_qr.png"
        } : null
      };
    }

    // Default Diocesan configuration (Maya disabled by default)
    return {
      gcash: {
        accountName: "TESTIMONIUM Sacramental Registry",
        accountNumber: "09171234567",
        qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/gcash_qr.png"
      },
      maya: null
    };
  }
}
