import type { IPaymentConfigurationProvider, PaymentConfiguration } from '../types';

export class DemoPaymentConfigurationProvider implements IPaymentConfigurationProvider {
  async getPaymentConfiguration(_requestId: string): Promise<PaymentConfiguration> {
    return {
      configured: true,
      qrCode: {
        enabled: true,
        imageUrl: 'https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/gcash_qr.png',
      },
    };
  }
}
