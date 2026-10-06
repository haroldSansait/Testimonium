import { useQuery } from "@tanstack/react-query";
import { legalApi } from "@/services/api/endpoints/legal";
import type { CurrentLegalPolicies } from "@/types/auth";

export const useLegalPolicies = () => {
  return useQuery<CurrentLegalPolicies, Error>({
    queryKey: ["legal-policies", "current"],
    queryFn: async () => {
      return legalApi.getCurrent();
    },
    staleTime: 5 * 60 * 1000,
  });
};
