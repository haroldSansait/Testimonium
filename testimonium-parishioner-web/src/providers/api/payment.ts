import type { IPaymentConfigurationProvider, PaymentConfiguration } from '../types';
import { client } from '../../api/client';

export class ApiPaymentConfigurationProvider implements IPaymentConfigurationProvider {
  async getPaymentConfiguration(parishId?: string): Promise<PaymentConfiguration> {
    try {
      const response = await client.get<any>('/payment/configuration', parishId ? { parishId } : undefined);
      const data = response?.data !== undefined ? response.data : response;
      if (data && (data.gcash || data.maya)) {
        return data;
      }
      throw new Error("Invalid backend configuration response");
    } catch (err) {
      console.warn("[ApiPaymentConfigurationProvider] Failed to fetch live configuration, using fallback:", err);
      return {
        gcash: {
          accountName: "TESTIMONIUM GCash Fallback",
          accountNumber: "0917-123-4567",
          qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/gcash_qr.png",
        },
        maya: {
          accountName: "TESTIMONIUM Maya Fallback",
          accountNumber: "0917-123-4567",
          qrCodeUrl: "https://pub-b6ab36a02c914579977dd08c3959e2f7.r2.dev/maya_qr.png",
        }
      };
    }
  }
}
