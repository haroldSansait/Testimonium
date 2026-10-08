import type { IRequestProvider } from "../types";
import type { SacramentalRequest, RequestAttachment } from "../../types";
import { client } from "../../api/client";

const mapFrontendToBackendDocType = (type: string): string => {
  const clean = String(type || '').toUpperCase().replace(/-/g, '_');
  if (clean.includes('BAPTISM')) return 'BAPTISMAL_CERTIFICATE';
  if (clean.includes('CONFIRMATION')) return 'CONFIRMATION_CERTIFICATE';
  if (clean.includes('MARRIAGE_BANNS') || clean === 'BANNS') return 'MARRIAGE_BANNS';
  if (clean.includes('PERMIT_TO_MARRY') || clean === 'PERMIT') return 'PERMIT_TO_MARRY';
  if (clean.includes('STATUS_OF_LIBERTY') || clean === 'LIBERTY') return 'STATUS_OF_LIBERTY';
  if (clean.includes('MARRIAGE')) return 'MARRIAGE_CERTIFICATE';
  if (clean.includes('COMMUNION')) return 'FIRST_COMMUNION_CERTIFICATE';
  if (clean.includes('_CERTIFICATE') || clean.includes('_BANNS') || clean.includes('_MARRY') || clean.includes('_LIBERTY')) {
    return clean;
  }
  return 'BAPTISMAL_CERTIFICATE';
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
      return "first-communion";
    case "MARRIAGE_BANNS":
      return "marriage-banns";
    case "PERMIT_TO_MARRY":
      return "permit-to-marry";
    case "STATUS_OF_LIBERTY":
      return "status-of-liberty";
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
    case 'PAYMENT_UNDER_REVIEW':
      return 'payment-under-review';
    case 'PAYMENT_NEEDS_CORRECTION':
      return 'payment-needs-correction';
    case 'PAYMENT_VERIFIED':
      return 'payment-verification';
    case 'PROCESSING':
    case 'READY_FOR_SIGNING':
      return 'processing';
    case 'READY_FOR_PICKUP':
      return 'ready';
    case 'COMPLETED':
      return 'completed';
    case 'REJECTED':
      return 'rejected';
    case 'CANCELLED':
      return 'cancelled';
    case 'NEEDS_CORRECTION':
      return 'needs-correction';
    default:
      return status.toLowerCase().replace(/_/g, '-') as RequestStatus;
  }
};

const mapRequest = (req: any): SacramentalRequest => {
  if (!req) return req;
  const parsedFee = req.fee !== null && req.fee !== undefined ? parseFloat(req.fee) : null;
  return {
    ...req,
    id: String(req.id),
    parishId: String(req.parishId),
    documentType: mapBackendToFrontendDocType(req.documentType),
    fee: parsedFee,
    status: mapBackendToFrontendStatus(req.status),
    submittedAt: req.dateRequested || req.createdAt,
    updatedAt: req.updatedAt || req.dateProcessed || req.createdAt,
    requirements: req.attachments?.map((a: any) => a.fileName) || [],
    correctionRequirementIds: req.correctionRequirementIds || [],
    correctionNote: req.correctionNote || null,
    paymentCorrectionNote: req.paymentCorrectionNote || null,
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
    applicantName?: string;
    applicantFirstName?: string;
    applicantMiddleName?: string;
    applicantLastName?: string;
    relationship: string;
    purpose: string;
    idempotencyKey?: string;
  }): Promise<SacramentalRequest> {
    const payload: any = {
      parishId: parseInt(request.parishId, 10),
      documentType: mapFrontendToBackendDocType(request.documentType),
      applicantFirstName: request.applicantFirstName,
      applicantMiddleName: request.applicantMiddleName,
      applicantLastName: request.applicantLastName,
      relationship: request.relationship,
      purpose: request.purpose,
    };
    if (request.applicantName) {
      payload.applicantName = request.applicantName;
    }
    const data = await client.post<any>("/requests", payload, request.idempotencyKey ? { headers: { "Idempotency-Key": request.idempotencyKey } } : undefined);
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
    formData.append("category", category);
    files.forEach((file) => {
      formData.append("files", file);
    });

    return client.post<RequestAttachment[]>(`/requests/${id}/files`, formData);
  }

  async uploadRegistrantId(id: string, files: { front?: File; back?: File }): Promise<any> {
    const formData = new FormData();
    if (files.front) formData.append("front", files.front);
    if (files.back) formData.append("back", files.back);
    return client.post<any>(`/requests/${id}/registrant-id`, formData);
  }

  async uploadReceipt(id: string, file: File): Promise<{ autoVerified: boolean; ocrResult: any; request?: SacramentalRequest }> {
    const formData = new FormData();
    formData.append("receipt", file);

    const response = await client.post<any>(`/requests/${id}/receipt`, formData);
    return {
      autoVerified: response.autoVerified,
      ocrResult: response.ocrResult,
      request: response.request ? mapRequest(response.request) : undefined,
    };
  }

  async getDocumentRequirements(type: string, parishId?: string, relationship?: string): Promise<any> {
    const backendType = mapFrontendToBackendDocType(type);
    const response = await client.get<any>('/document-requirements', { type: backendType, parishId, relationship });
    return response.data || response;
  }

  async resubmitCorrections(id: string): Promise<SacramentalRequest> {
    const response = await client.post<any>(`/requests/${id}/resubmit-corrections`);
    return mapRequest(response.data || response);
  }
}
