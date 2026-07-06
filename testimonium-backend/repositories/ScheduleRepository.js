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
  async findMany({ page = 1, limit = 10, search, status } = {}) {
    const skip = (page - 1) * limit;

    const where = {};

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
  async findTodayEvents() {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    return prisma.schedule.findMany({
      where: {
        requestedDate: {
          gte: startOfDay,
          lt: endOfDay,
        },
      },
      include: listInclude,
      orderBy: { startDatetime: "asc" },
    });
  }

  /**
   * Returns all schedule entries whose requestedDate falls within a given calendar month.
   * @param {number} year
   * @param {number} month - 1-based (1 = January)
   */
  async findByMonth(year, month) {
    const startOfMonth = new Date(year, month - 1, 1);
    const startOfNextMonth = new Date(year, month, 1);

    return prisma.schedule.findMany({
      where: {
        requestedDate: {
          gte: startOfMonth,
          lt: startOfNextMonth,
        },
      },
      include: listInclude,
      orderBy: { requestedDate: "asc" },
    });
  }

  /**
   * Count of pending schedule requests for dashboard stats.
   */
  async countPending() {
    return prisma.schedule.count({ where: { status: "PENDING" } });
  }
}
