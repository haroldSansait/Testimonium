import type { IPaymentConfigurationProvider, PaymentConfiguration } from '../types';
import { client } from '../../api/client';

export class ApiPaymentConfigurationProvider implements IPaymentConfigurationProvider {
  async getPaymentConfiguration(requestId: string): Promise<PaymentConfiguration> {
    const data = await client.get<PaymentConfiguration>('/payment/configuration', { requestId });
    if (!data || typeof data.configured !== 'boolean' || !data.qrCode) {
      throw new Error('Invalid backend payment configuration response');
    }
    return data;
  }
}
