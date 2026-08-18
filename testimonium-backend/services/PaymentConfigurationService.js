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
      const qrCodeUrl = (parish.paymentQrEnabled && parish.paymentQrImage) ? parish.paymentQrImage : null;
      return {
        gcash: {
          accountName: `${parish.parishName} Sacramental Fees`,
          accountNumber: parish.contactNumber || "0917-111-2222",
          qrCodeUrl: qrCodeUrl
        },
        maya: mayaEnabled ? {
          accountName: `${parish.parishName} Maya Registry`,
          accountNumber: parish.contactNumber || "0917-111-2222",
          qrCodeUrl: qrCodeUrl
        } : null
      };
    }

    // Default Diocesan configuration (Maya disabled by default)
    return {
      gcash: {
        accountName: "TESTIMONIUM Sacramental Registry",
        accountNumber: "09171234567",
        qrCodeUrl: null
      },
      maya: null
    };
  }
}
