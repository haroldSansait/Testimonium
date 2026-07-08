import { prisma } from "../config/db.js";

export class AnalyticsRepository {
  /**
   * Get counts of document requests, schedules, active users, and active parishes.
   * @returns {Promise<object>}
   */
  async getOverviewStats() {
    const [documents, schedules, users, parishes] = await Promise.all([
      prisma.documentRequest.count(),
      prisma.schedule.count(),
      prisma.user.count({ where: { status: "ACTIVE" } }),
      prisma.parish.count({ where: { isActive: true } }),
    ]);
    return { documents, schedules, users, parishes };
  }

  /**
   * Get sacrament schedule counts for current year and previous year to calculate trend.
   * @param {Date} currentYearStart
   * @param {Date} currentYearEnd
   * @param {Date} prevYearStart
   * @param {Date} prevYearEnd
   * @returns {Promise<object>}
   */
  async getSacramentScheduleCounts(currentYearStart, currentYearEnd, prevYearStart, prevYearEnd) {
    const [currentYearCounts, prevYearCounts] = await Promise.all([
      prisma.schedule.groupBy({
        by: ['eventType'],
        where: {
          requestedDate: {
            gte: currentYearStart,
            lte: currentYearEnd
          },
          status: 'CONFIRMED'
        },
        _count: true
      }),
      prisma.schedule.groupBy({
        by: ['eventType'],
        where: {
          requestedDate: {
            gte: prevYearStart,
            lte: prevYearEnd
          },
          status: 'CONFIRMED'
        },
        _count: true
      })
    ]);
    return { currentYearCounts, prevYearCounts };
  }

  /**
   * Get sacrament document request counts for current year and previous year to calculate trend.
   * @param {Date} currentYearStart
   * @param {Date} currentYearEnd
   * @param {Date} prevYearStart
   * @param {Date} prevYearEnd
   * @returns {Promise<object>}
   */
  async getSacramentDocumentCounts(currentYearStart, currentYearEnd, prevYearStart, prevYearEnd) {
    const [currentYearCounts, prevYearCounts] = await Promise.all([
      prisma.documentRequest.groupBy({
        by: ['documentType'],
        where: {
          dateRequested: {
            gte: currentYearStart,
            lte: currentYearEnd
          }
        },
        _count: true
      }),
      prisma.documentRequest.groupBy({
        by: ['documentType'],
        where: {
          dateRequested: {
            gte: prevYearStart,
            lte: prevYearEnd
          }
        },
        _count: true
      })
    ]);
    return { currentYearCounts, prevYearCounts };
  }

  /**
   * Get document request counts grouped by type and status.
   * @returns {Promise<Array>}
   */
  async getDocumentRequestCountsByStatus() {
    return prisma.documentRequest.groupBy({
      by: ['documentType', 'status'],
      _count: true
    });
  }

  /**
   * Get processing times for document requests with a processed date.
   * @returns {Promise<Array>}
   */
  async getProcessedDocumentRequests() {
    return prisma.documentRequest.findMany({
      where: {
        dateProcessed: { not: null }
      },
      select: {
        documentType: true,
        dateRequested: true,
        dateProcessed: true
      }
    });
  }

  /**
   * Get parish analytics: list of active parishes and counts grouped by parishId.
   * @param {Date} thirtyDaysAgo
   * @returns {Promise<object>}
   */
  async getParishAnalyticsData(thirtyDaysAgo) {
    const [parishes, requestCounts, activeParishionerCounts, newRegistrationCounts] = await Promise.all([
      prisma.parish.findMany({
        where: { isActive: true },
        select: { id: true, parishName: true }
      }),
      prisma.documentRequest.groupBy({
        by: ['parishId'],
        _count: true
      }),
      prisma.user.groupBy({
        by: ['parishId'],
        where: {
          role: { roleName: 'PARISHIONER' },
          status: 'ACTIVE'
        },
        _count: true
      }),
      prisma.user.groupBy({
        by: ['parishId'],
        where: {
          role: { roleName: 'PARISHIONER' },
          createdAt: { gte: thirtyDaysAgo }
        },
        _count: true
      })
    ]);

    return { parishes, requestCounts, activeParishionerCounts, newRegistrationCounts };
  }
}
