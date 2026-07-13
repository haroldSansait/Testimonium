import type { IPaymentConfigurationProvider, PaymentConfiguration } from '../types';

export class DemoPaymentConfigurationProvider implements IPaymentConfigurationProvider {
  async getPaymentConfiguration(_parishId?: string): Promise<PaymentConfiguration> {
    return {
      gcash: {
        accountName: "St. Joseph Parish GCash",
        accountNumber: "0917-111-2222",
        qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/gcash_qr.png",
      },
      maya: {
        accountName: "St. Joseph Parish Maya",
        accountNumber: "0917-111-2222",
        qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/maya_qr.png",
      }
    };
  }
}
