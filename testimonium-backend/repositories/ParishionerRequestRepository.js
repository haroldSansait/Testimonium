import { prisma } from "../config/db.js";

const detailInclude = {
  parish: {
    select: {
      id: true,
      parishName: true,
      type: true,
      municipalityCity: true,
      province: true,
    },
  },
  processedBy: {
    select: {
      id: true,
      fullName: true,
      email: true,
    },
  },
  attachments: {
    select: {
      id: true,
      requestId: true,
      fileName: true,
      fileType: true,
      fileSize: true,
      category: true,
      uploadedAt: true,
    },
    orderBy: {
      uploadedAt: "asc",
    },
  },
  registrantIdEvidence: {
    select: {
      frontUploadedAt: true,
      frontRevision: true,
      backUploadedAt: true,
      backRevision: true,
      ocrStatus: true,
      updatedAt: true,
    },
  },
  paymentTransactions: {
    include: {
      receipts: {
        select: {
          id: true,
          paymentTransactionId: true,
          fileName: true,
          mimeType: true,
          fileSize: true,
          attemptVersion: true,
          isSuperseded: true,
          uploadedAt: true,
          ocrResult: true,
        },
        orderBy: {
          attemptVersion: "desc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  },
  requestHistory: {
    include: {
      actor: {
        select: {
          id: true,
          fullName: true,
          role: {
            select: {
              roleName: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: "asc",
    },
  },
};

export class ParishionerRequestRepository {
  /**
   * Creates a draft document request.
   */
  async create(data) {
    return prisma.documentRequest.create({
      data: {
        userId: data.userId,
        parishId: data.parishId,
        documentType: data.documentType,
        applicantName: data.applicantName,
        relationship: data.relationship,
        purpose: data.purpose,
        isDraft: true,
        status: "PENDING",
        paymentStatus: "UNPAID",
        fee: data.fee !== undefined ? data.fee : null,
      },
      include: detailInclude,
    });
  }

  /**
   * Updates request details (e.g. tracking number, status, isDraft).
   */
  async update(id, data, tx) {
    const client = tx || prisma;
    return client.documentRequest.update({
      where: { id },
      data,
      include: detailInclude,
    });
  }

  /**
   * Finds a document request by ID, enforcing user ownership.
   */
  async findById(id, userId) {
    return prisma.documentRequest.findFirst({
      where: {
        id,
        userId,
      },
      include: detailInclude,
    });
  }

  /**
   * Finds a document request by tracking number, enforcing user ownership.
   */
  async findByTrackingNumber(trackingNumber, userId) {
    return prisma.documentRequest.findFirst({
      where: {
        trackingNumber: {
          equals: trackingNumber.trim(),
          mode: "insensitive",
        },
        userId,
      },
      include: detailInclude,
    });
  }

  /**
   * Returns a paginated list of requests for a user, with filters.
   */
  async findMany({ userId, page = 1, limit = 10, search, status, documentType } = {}) {
    const skip = (page - 1) * limit;
    const where = { userId };

    if (status) {
      where.status = status;
    }

    if (documentType) {
      where.documentType = documentType;
    }

    if (search) {
      where.OR = [
        { trackingNumber: { contains: search, mode: "insensitive" } },
        { applicantName: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.documentRequest.findMany({
        where,
        include: detailInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.documentRequest.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Writes a status transition / activity to RequestHistory.
   */
  async createHistoryEntry({ requestId, actorId, action, oldStatus, newStatus, remarks }, tx) {
    const client = tx || prisma;
    return client.requestHistory.create({
      data: {
        requestId,
        actorId,
        action,
        oldStatus,
        newStatus,
        remarks,
      },
    });
  }
}
