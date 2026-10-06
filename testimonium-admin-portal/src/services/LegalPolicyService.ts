import api from '@/api/api';
import type { ApiResponseEnvelope } from '@/types/api';

export interface ManagedLegalPolicy {
  policyType: 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY';
  version: string;
  revision: number;
  effectiveAt: string;
  updatedAt: string;
  content: string;
  updatedBy: {
    id: number;
    fullName: string;
  } | null;
}

export interface ManagePoliciesResponse {
  termsOfService: ManagedLegalPolicy;
  privacyPolicy: ManagedLegalPolicy;
}

export interface UpdatePolicyPayload {
  content: string;
  expectedRevision: number;
}

export interface UpdatePolicyResponse {
  changed: boolean;
  policy: ManagedLegalPolicy;
}

export const LegalPolicyService = {
  async getManagePolicies(): Promise<ManagePoliciesResponse> {
    const response = await api.get<ApiResponseEnvelope<ManagePoliciesResponse>>('/legal-policies/manage');
    return response.data.data;
  },

  async updatePolicy(
    policyType: 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY',
    payload: UpdatePolicyPayload
  ): Promise<UpdatePolicyResponse> {
    const response = await api.patch<ApiResponseEnvelope<UpdatePolicyResponse>>(
      `/legal-policies/${policyType}`,
      payload
    );
    return response.data.data;
  },
};
