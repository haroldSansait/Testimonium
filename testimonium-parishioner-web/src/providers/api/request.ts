import type { IRequestProvider } from "../types";
import type { SacramentalRequest, RequestAttachment } from "../../types";
import { client } from "../../api/client";

const mapFrontendToBackendDocType = (type: string): string => {
  switch (type) {
    case "baptism":
      return "BAPTISMAL_CERTIFICATE";
    case "confirmation":
      return "CONFIRMATION_CERTIFICATE";
    case "marriage":
      return "MARRIAGE_CERTIFICATE";
    case "first-communion":
    case "first_communion":
      return "FIRST_COMMUNION_CERTIFICATE";
    default:
      // Return uppercase backend representation if it is already mapped
      if (type.includes("_CERTIFICATE")) {
        return type;
      }
      return "BAPTISMAL_CERTIFICATE";
  }
};

const mapBackendToFrontendDocType = (type: string): any => {
  switch (type) {
    case "BAPTISMAL_CERTIFICATE":
      return "baptism";
    case "CONFIRMATION_CERTIFICATE":
      return "confirmation";
    case "MARRIAGE_CERTIFICATE":
      return "marriage";
    case "FIRST_COMMUNION_CERTIFICATE":
      return "other";
    default:
      return type;
  }
};

import type { RequestStatus } from "../../types";

const mapBackendToFrontendStatus = (status: string): RequestStatus => {
  switch (status) {
    case 'PENDING':
      return 'pending';
    case 'UNDER_REVIEW':
      return 'under-review';
    case 'PAYMENT_PENDING':
      return 'payment-pending';
    case 'PAYMENT_VERIFIED':
      return 'payment-verification';
    case 'PROCESSING':
      return 'processing';
    case 'READY_FOR_PICKUP':
      return 'ready';
    case 'COMPLETED':
      return 'completed';
    case 'REJECTED':
      return 'rejected';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return status.toLowerCase().replace(/_/g, '-') as RequestStatus;
  }
};

const mapRequest = (req: any): SacramentalRequest => {
  if (!req) return req;
  return {
    ...req,
    id: String(req.id),
    parishId: String(req.parishId),
    documentType: mapBackendToFrontendDocType(req.documentType),
    status: mapBackendToFrontendStatus(req.status),
    submittedAt: req.dateRequested || req.createdAt,
    updatedAt: req.updatedAt || req.dateProcessed || req.createdAt,
    requirements: req.attachments?.map((a: any) => a.fileName) || [],
  };
};

export class ApiRequestProvider implements IRequestProvider {
  async getRequests(filters?: any): Promise<SacramentalRequest[]> {
    const response = await client.get<any>("/requests", filters);
    const list = Array.isArray(response)
      ? response
      : response?.data || response?.items || [];
    return list.map(mapRequest);
  }

  async getRequestById(id: string): Promise<SacramentalRequest | null> {
    const response = await client.get<any>(`/requests/${id}`);
    const data = response?.data !== undefined ? response.data : response;
    return mapRequest(data);
  }

  async getRequestByTrackingNumber(trackingNumber: string): Promise<SacramentalRequest | null> {
    const response = await client.get<any>(`/requests/tracking/${trackingNumber}`);
    const data = response?.data !== undefined ? response.data : response;
    return mapRequest(data);
  }

  async createRequest(request: {
    parishId: string;
    documentType: SacramentalRequest["documentType"];
    applicantName: string;
    relationship: string;
    purpose: string;
  }): Promise<SacramentalRequest> {
    const payload = {
      parishId: parseInt(request.parishId, 10),
      documentType: mapFrontendToBackendDocType(request.documentType),
      applicantName: request.applicantName,
      relationship: request.relationship,
      purpose: request.purpose,
    };
    const data = await client.post<any>("/requests", payload);
    return mapRequest(data);
  }

  async submitDraft(id: string): Promise<SacramentalRequest> {
    const data = await client.post<any>(`/requests/${id}/submit`);
    return mapRequest(data);
  }

  async cancelRequest(id: string, remarks?: string): Promise<SacramentalRequest> {
    const data = await client.post<any>(`/requests/${id}/cancel`, { remarks });
    return mapRequest(data);
  }

  async uploadFiles(id: string, files: File[], category: string = "supporting"): Promise<RequestAttachment[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("files", file);
    });
    formData.append("category", category);

    return client.post<RequestAttachment[]>(`/requests/${id}/files`, formData);
  }

  async uploadReceipt(id: string, file: File): Promise<{ autoVerified: boolean; ocrResult: any }> {
    const formData = new FormData();
    formData.append("receipt", file);

    return client.post<any>(`/requests/${id}/receipt`, formData);
  }
}
