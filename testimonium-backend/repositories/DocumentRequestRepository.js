import { prisma } from "../config/db.js";

const listInclude = {
  user: {
    select: { id: true, fullName: true, email: true, contactNumber: true },
  },
  parish: {
    select: { id: true, parishName: true, type: true, municipalityCity: true },
  },
  processedBy: {
    select: { id: true, fullName: true },
  },
  attachments: {
    orderBy: {
      uploadedAt: "asc",
    },
  },
  paymentTransactions: {
    include: {
      receipts: {
        include: {
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


export class DocumentRequestRepository {
  /**
   * Paginated list of document requests with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.search   - searches user fullName or purpose
   * @param {string|undefined} opts.status   - DocumentRequestStatus enum value
   * @param {string|undefined} opts.documentType - DocumentType enum value
   */
  async findMany({ page = 1, limit = 10, search, status, documentType, parishId } = {}) {
    const skip = (page - 1) * limit;

    const where = { isDraft: false };

    if (parishId) {
      where.parishId = parseInt(parishId, 10);
    }

    if (status) {
      where.status = status;
    }

    if (documentType) {
      where.documentType = documentType;
    }

    if (search) {
      where.OR = [
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { purpose: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.documentRequest.findMany({
        where,
        include: listInclude,
        orderBy: { dateRequested: "desc" },
        skip,
        take: limit,
      }),
      prisma.documentRequest.count({ where }),
    ]);

    return { data, total };
  }

  async countStats(parishId) {
    const pendingWhere = {
      status: {
        in: ["PENDING", "UNDER_REVIEW", "PAYMENT_PENDING", "PAYMENT_VERIFIED", "PROCESSING", "READY_FOR_SIGNING"]
      },
      isDraft: false
    };
    const pickupWhere = { status: "READY_FOR_PICKUP", isDraft: false };

    if (parishId) {
      pendingWhere.parishId = parseInt(parishId, 10);
      pickupWhere.parishId = parseInt(parishId, 10);
    }

    const [pending, readyForPickup] = await Promise.all([
      prisma.documentRequest.count({ where: pendingWhere }),
      prisma.documentRequest.count({ where: pickupWhere }),
    ]);

    return { pending, readyForPickup };
  }
}
