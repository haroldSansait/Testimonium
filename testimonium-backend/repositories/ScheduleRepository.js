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

export class ScheduleRepository {
  /**
   * Paginated list of schedule requests with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.search   - searches user fullName or remarks
   * @param {string|undefined} opts.status   - ScheduleStatus enum value
   */
  async findMany({ page = 1, limit = 10, search, status, parishId } = {}) {
    const skip = (page - 1) * limit;

    const where = {};

    if (parishId) {
      where.parishId = parseInt(parishId, 10);
    }

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { remarks: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.schedule.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Returns all schedule entries whose requestedDate is today (local calendar day).
   */
  async findTodayEvents(parishId) {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const where = {
      requestedDate: {
        gte: startOfDay,
        lt: endOfDay,
      },
    };

    if (parishId) {
      where.parishId = parseInt(parishId, 10);
    }

    return prisma.schedule.findMany({
      where,
      include: listInclude,
      orderBy: { startDatetime: "asc" },
    });
  }

  /**
   * Returns all schedule entries whose requestedDate falls within a given calendar month.
   * @param {number} year
   * @param {number} month - 1-based (1 = January)
   * @param {number|undefined} parishId
   */
  async findByMonth(year, month, parishId) {
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    const where = {
      requestedDate: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    };

    if (parishId) {
      where.parishId = parseInt(parishId, 10);
    }

    return prisma.schedule.findMany({
      where,
      include: listInclude,
      orderBy: { requestedDate: "asc" },
    });
  }

  /**
   * Count of pending schedule requests for dashboard stats.
   */
  async countPending(parishId) {
    const where = { status: "PENDING" };
    if (parishId) {
      where.parishId = parseInt(parishId, 10);
    }
    return prisma.schedule.count({ where });
  }
}
