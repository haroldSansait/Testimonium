import type { IRequestProvider } from '../types';
import type { SacramentalRequest } from '../../types';

const INITIAL_REQUESTS: SacramentalRequest[] = [
  {
    id: 'req1',
    trackingNumber: 'TX-2026-88401',
    parishId: 'p1',
    documentType: 'baptism',
    status: 'under-review',
    applicantName: 'Juan dela Cruz Jr.',
    relationship: 'Self',
    purpose: 'Passport Application',
    isDraft: false,
    submittedAt: '2026-07-08T10:30:00Z',
    updatedAt: '2026-07-09T14:22:00Z',
    requirements: ['birth_certificate.pdf', 'parents_marriage_cert.png']
  },
  {
    id: 'req2',
    trackingNumber: 'TX-2026-90412',
    parishId: 'p2',
    documentType: 'marriage',
    status: 'ready',
    applicantName: 'Pedro Santos & Maria Gomez',
    relationship: 'Groom',
    purpose: 'Civil Registration Reference',
    isDraft: false,
    submittedAt: '2026-07-01T08:15:00Z',
    updatedAt: '2026-07-05T09:00:00Z',
    requirements: ['baptismal_certs.zip', 'confirmation_certs.zip', 'cenomar.pdf']
  }
];

export class DemoRequestProvider implements IRequestProvider {
  private requests: SacramentalRequest[];

  constructor() {
    const cached = localStorage.getItem('testimonium_demo_requests');
    if (cached) {
      try {
        this.requests = JSON.parse(cached);
      } catch {
        this.requests = INITIAL_REQUESTS;
      }
    } else {
      this.requests = INITIAL_REQUESTS;
      localStorage.setItem('testimonium_demo_requests', JSON.stringify(this.requests));
    }
  }

  private save() {
    localStorage.setItem('testimonium_demo_requests', JSON.stringify(this.requests));
  }

  async getRequests(): Promise<SacramentalRequest[]> {
    await new Promise(resolve => setTimeout(resolve, 300));
    return [...this.requests];
  }

  async getRequestByTrackingNumber(trackingNumber: string): Promise<SacramentalRequest | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.requests.find(r => r.trackingNumber?.toLowerCase() === trackingNumber.trim().toLowerCase()) || null;
  }

  async getRequestById(id: string): Promise<SacramentalRequest | null> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return this.requests.find(r => r.id === id) || null;
  }

  async createRequest(request: {
    parishId: string;
    documentType: SacramentalRequest['documentType'];
    applicantName: string;
    relationship: string;
    purpose: string;
  }): Promise<SacramentalRequest> {
    await new Promise(resolve => setTimeout(resolve, 400));
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const trackingNumber = `SR-2026-${randomSuffix}`;
    const newRequest: SacramentalRequest = {
      id: `req_${Date.now()}`,
      trackingNumber,
      parishId: request.parishId,
      documentType: request.documentType,
      status: 'pending',
      applicantName: request.applicantName,
      relationship: request.relationship,
      purpose: request.purpose,
      isDraft: true, // starts as draft
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      requirements: [],
      attachments: [],
      paymentTransactions: [],
      requestHistory: [
        {
          id: Date.now(),
          requestId: Date.now(),
          action: 'DRAFT_CREATED',
          remarks: 'Draft request initialized in demo mode',
          createdAt: new Date().toISOString()
        }
      ]
    };
    this.requests.unshift(newRequest);
    this.save();
    return newRequest;
  }

  async submitDraft(id: string): Promise<SacramentalRequest> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const request = this.requests.find(r => r.id === id);
    if (!request) throw new Error("Request not found");
    request.isDraft = false;
    request.status = 'pending';
    request.updatedAt = new Date().toISOString();
    request.requestHistory?.push({
      id: Date.now(),
      requestId: parseInt(id.replace(/\D/g, '')) || Date.now(),
      action: 'SUBMITTED',
      oldStatus: 'pending',
      newStatus: 'pending',
      remarks: 'Submitted in demo mode',
      createdAt: new Date().toISOString()
    });
    this.save();
    return request;
  }

  async cancelRequest(id: string, remarks?: string): Promise<SacramentalRequest> {
    await new Promise(resolve => setTimeout(resolve, 300));
    const request = this.requests.find(r => r.id === id);
    if (!request) throw new Error("Request not found");
    const oldStatus = request.status;
    request.status = 'cancelled';
    request.updatedAt = new Date().toISOString();
    request.requestHistory?.push({
      id: Date.now(),
      requestId: parseInt(id.replace(/\D/g, '')) || Date.now(),
      action: 'CANCELLED',
      oldStatus,
      newStatus: 'cancelled',
      remarks: remarks || 'Cancelled in demo mode',
      createdAt: new Date().toISOString()
    });
    this.save();
    return request;
  }

  async uploadFiles(id: string, files: File[], category: string = "supporting"): Promise<any[]> {
    await new Promise(resolve => setTimeout(resolve, 500));
    const request = this.requests.find(r => r.id === id);
    if (!request) throw new Error("Request not found");
    
    const newAttachments = files.map((file, index) => ({
      id: Date.now() + index,
      requestId: parseInt(id.replace(/\D/g, '')) || Date.now(),
      fileName: file.name,
      r2ObjectKey: `demo/req_${id}/${category}/${file.name}`,
      fileSize: file.size,
      fileType: file.type,
      category,
      uploadedAt: new Date().toISOString()
    }));

    request.attachments = [...(request.attachments || []), ...newAttachments];
    request.requirements = [...request.requirements, ...files.map(f => f.name)];
    request.updatedAt = new Date().toISOString();
    this.save();
    return newAttachments;
  }

  async uploadReceipt(id: string, file: File): Promise<any> {
    await new Promise(resolve => setTimeout(resolve, 600));
    const request = this.requests.find(r => r.id === id);
    if (!request) throw new Error("Request not found");
    
    const autoVerified = file.name.toLowerCase().includes("gcash") || file.name.toLowerCase().includes("verified");
    
    request.paymentStatus = autoVerified ? 'CONFIRMED' as any : 'PROOF_SUBMITTED' as any;
    const oldStatus = request.status;
    if (autoVerified) {
      request.status = 'payment-verification'; // maps to PAYMENT_VERIFIED
    }
    
    const transaction = {
      id: Date.now(),
      requestId: parseInt(id.replace(/\D/g, '')) || Date.now(),
      amount: 100.00,
      provider: file.name.toLowerCase().includes("gcash") ? "GCash" : "Maya",
      referenceNumber: "901234567890",
      status: autoVerified ? 'VERIFIED' : 'PENDING',
      createdAt: new Date().toISOString()
    };
    
    request.paymentTransactions = [transaction as any];
    request.updatedAt = new Date().toISOString();
    
    request.requestHistory?.push({
      id: Date.now(),
      requestId: parseInt(id.replace(/\D/g, '')) || Date.now(),
      action: autoVerified ? 'PAYMENT_AUTO_VERIFIED' : 'RECEIPT_UPLOADED',
      oldStatus,
      newStatus: request.status,
      remarks: autoVerified ? 'Auto-verified in demo mode' : 'Proof uploaded in demo mode',
      createdAt: new Date().toISOString()
    });
    
    this.save();
    return {
      autoVerified,
      ocrResult: {
        confidenceScore: autoVerified ? 0.95 : 0.40,
        referenceNumber: "901234567890",
        amount: "100.00",
        provider: transaction.provider
      }
    };
  }
}
