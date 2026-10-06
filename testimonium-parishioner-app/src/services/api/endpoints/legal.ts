import { apiClient } from "../client";
import type { CurrentLegalPolicies } from "@/types/auth";

const parsePolicy = (
  value: unknown,
  expectedType: "TERMS_OF_SERVICE" | "PRIVACY_POLICY"
): CurrentLegalPolicies["termsOfService"] => {
  if (!value || typeof value !== "object") throw new Error("Malformed legal policy response from server.");
  const policy = value as Record<string, unknown>;
  if (policy.policyType !== expectedType || !Number.isInteger(policy.revision) ||
      Number(policy.revision) < 1 || policy.version !== `v${policy.revision}.0` ||
      typeof policy.effectiveAt !== "string" || Number.isNaN(Date.parse(policy.effectiveAt)) ||
      typeof policy.content !== "string" || !policy.content.trim() || policy.content.length > 50000) {
    throw new Error("Malformed legal policy response from server.");
  }
  return policy as unknown as CurrentLegalPolicies["termsOfService"];
};

export const parseCurrentLegalPolicies = (value: unknown): CurrentLegalPolicies => {
  if (!value || typeof value !== "object") throw new Error("Malformed legal policy response from server.");
  const data = value as Record<string, unknown>;
  return {
    termsOfService: parsePolicy(data.termsOfService, "TERMS_OF_SERVICE"),
    privacyPolicy: parsePolicy(data.privacyPolicy, "PRIVACY_POLICY"),
  };
};

export const legalApi = {
  getCurrent: async () => {
    const response = await apiClient.request<unknown>({
      path: "/legal-policies/current",
      auth: false,
    });
    return parseCurrentLegalPolicies(response);
  },
};
