import { useState, useEffect, useCallback, useRef } from 'react';
import { client } from '../api/client';

export interface LegalPolicyItem {
  policyType: 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY';
  version: string;
  revision: number;
  effectiveAt: string;
  content: string;
}

export interface CurrentLegalPolicies {
  termsOfService: LegalPolicyItem;
  privacyPolicy: LegalPolicyItem;
}

let cachedPolicies: CurrentLegalPolicies | null = null;
let inFlightPromise: Promise<CurrentLegalPolicies> | null = null;

const parsePolicy = (value: unknown, expectedType: LegalPolicyItem['policyType']): LegalPolicyItem => {
  if (!value || typeof value !== 'object') throw new Error('Malformed legal policy response from server.');
  const policy = value as Record<string, unknown>;
  if (policy.policyType !== expectedType ||
      !Number.isInteger(policy.revision) || Number(policy.revision) < 1 ||
      policy.version !== `v${policy.revision}.0` ||
      typeof policy.effectiveAt !== 'string' || Number.isNaN(Date.parse(policy.effectiveAt)) ||
      typeof policy.content !== 'string' || !policy.content.trim() || policy.content.length > 50000) {
    throw new Error('Malformed legal policy response from server.');
  }
  return policy as unknown as LegalPolicyItem;
};

export const parseCurrentLegalPolicies = (value: unknown): CurrentLegalPolicies => {
  if (!value || typeof value !== 'object') throw new Error('Malformed legal policy response from server.');
  const data = value as Record<string, unknown>;
  return {
    termsOfService: parsePolicy(data.termsOfService, 'TERMS_OF_SERVICE'),
    privacyPolicy: parsePolicy(data.privacyPolicy, 'PRIVACY_POLICY'),
  };
};

export const fetchCurrentLegalPolicies = async (forceRefresh = false): Promise<CurrentLegalPolicies> => {
  if (!forceRefresh && cachedPolicies) {
    return cachedPolicies;
  }

  if (inFlightPromise) {
    return inFlightPromise;
  }

  inFlightPromise = (async () => {
    try {
      const response = await client.get<CurrentLegalPolicies>('/legal-policies/current');
      const data = parseCurrentLegalPolicies(response);
      cachedPolicies = data;
      return data;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
};

export const useLegalPolicies = () => {
  const [policies, setPolicies] = useState<CurrentLegalPolicies | null>(cachedPolicies);
  const [loading, setLoading] = useState(!cachedPolicies);
  const [error, setError] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const loadPolicies = useCallback(async (force = false) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchCurrentLegalPolicies(force);
      if (isMountedRef.current) {
        setPolicies(result);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load authoritative legal policies. Please retry.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  return {
    policies,
    loading,
    error,
    refetch: () => loadPolicies(true),
  };
};
