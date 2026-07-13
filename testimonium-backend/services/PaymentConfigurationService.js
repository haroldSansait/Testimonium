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

    if (parish) {
      return {
        gcash: {
          accountName: `${parish.parishName} Sacramental Fees`,
          accountNumber: parish.contactNumber || "0917-111-2222",
          qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/gcash_qr.png"
        },
        maya: {
          accountName: `${parish.parishName} Maya Registry`,
          accountNumber: parish.contactNumber || "0917-111-2222",
          qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/maya_qr.png"
        }
      };
    }

    // Default Diocesan configuration
    return {
      gcash: {
        accountName: "TESTIMONIUM Sacramental Registry",
        accountNumber: "09171234567",
        qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/gcash_qr.png"
      },
      maya: {
        accountName: "TESTIMONIUM Maya Registry",
        accountNumber: "09171234567",
        qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/maya_qr.png"
      }
    };
  }
}
