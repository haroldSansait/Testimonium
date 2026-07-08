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

    const where = {};

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

  /**
   * Returns dashboard stat counts across all document requests.
   * @param {number|undefined} parishId
   */
  async countStats(parishId) {
    const pendingWhere = { status: "PENDING" };
    const pickupWhere = { status: "READY_FOR_PICKUP" };

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
