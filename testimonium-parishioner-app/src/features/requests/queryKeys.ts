import { DocumentRequestListFilters } from "./types";

export const requestKeys = {
  all: (uid?: string | null) => ["requests", uid ?? "anon"] as const,
  lists: (uid?: string | null) => [...requestKeys.all(uid), "list"] as const,
  list: (uid?: string | null, filters?: DocumentRequestListFilters) =>
    [...requestKeys.lists(uid), filters ?? {}] as const,
  details: (uid?: string | null) => [...requestKeys.all(uid), "detail"] as const,
  detail: (uid?: string | null, requestId?: string | number | null) =>
    [...requestKeys.details(uid), String(requestId ?? "")] as const,
  tracking: (uid?: string | null, trackingNumber?: string | null) =>
    [...requestKeys.all(uid), "tracking", String(trackingNumber ?? "")] as const,
  requirements: (
    uid?: string | null,
    params?: {
      documentType?: string | null;
      parishId?: string | number | null;
      relationship?: string | null;
    }
  ) =>
    [
      ...requestKeys.all(uid),
      "requirements",
      {
        documentType: params?.documentType ?? "",
        parishId: params?.parishId ? String(params.parishId) : "",
        relationship: params?.relationship ?? "",
      },
    ] as const,
};

export const paymentKeys = {
  all: (uid?: string | null) => ["payments", uid ?? "anon"] as const,
  configurations: (uid?: string | null) =>
    [...paymentKeys.all(uid), "configuration"] as const,
  configuration: (uid?: string | null, requestId?: string | number | null) =>
    [...paymentKeys.configurations(uid), { requestId: String(requestId ?? "") }] as const,
};
