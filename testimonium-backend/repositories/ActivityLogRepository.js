import { prisma } from "../config/db.js";

const listInclude = {
  user: {
    select: { id: true, fullName: true, email: true },
  },
};

export class ActivityLogRepository {
  /**
   * Paginated list of activity logs with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.personnelName - searches related user's fullName
   * @param {string|undefined} opts.action        - partial match on action description
   * @param {string|undefined} opts.startDate     - ISO date string (inclusive)
   * @param {string|undefined} opts.endDate       - ISO date string (inclusive)
   */
  async findMany({ page = 1, limit = 10, personnelName, action, startDate, endDate } = {}) {
    const skip = (page - 1) * limit;

    const where = {};

    if (personnelName) {
      where.user = {
        fullName: { contains: personnelName, mode: "insensitive" },
      };
    }

    if (action) {
      where.action = { contains: action, mode: "insensitive" };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Include the entire end date by moving to start of next day
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        where.createdAt.lt = end;
      }
    }

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: listInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { data, total };
  }
}
