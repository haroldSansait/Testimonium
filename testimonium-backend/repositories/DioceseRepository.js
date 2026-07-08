import { prisma } from "../config/db.js";

export class DioceseRepository {
  /**
   * Count parishes of a specific type.
   * @param {string} type - PARISH, QUASI_PARISH, or MISSION_STATION
   * @returns {Promise<number>}
   */
  async countParishesByType(type) {
    return prisma.parish.count({
      where: {
        type,
        isActive: true,
      },
    });
  }

  /**
   * Count active users with a specific role name.
   * @param {string} roleName
   * @returns {Promise<number>}
   */
  async countUsersByRole(roleName) {
    return prisma.user.count({
      where: {
        role: {
          roleName,
        },
        status: "ACTIVE",
      },
    });
  }

  /**
   * Count all document requests with PENDING status.
   * @returns {Promise<number>}
   */
  async countPendingDocumentRequests() {
    return prisma.documentRequest.count({
      where: {
        status: "PENDING",
      },
    });
  }

  /**
   * Count all schedule requests with PENDING status.
   * @returns {Promise<number>}
   */
  async countPendingScheduleRequests() {
    return prisma.schedule.count({
      where: {
        status: "PENDING",
      },
    });
  }

  /**
   * Retrieve the most recent activity logs, including user and user's parish.
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async findRecentActivity(limit = 10) {
    return prisma.activityLog.findMany({
      where: {
        archivedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: limit,
      include: {
        user: {
          include: {
            parish: true,
          },
        },
      },
    });
  }

  /**
   * Retrieve the most recent notifications for a user.
   * @param {number} userId
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async findNotifications(userId, limit = 10) {
    return prisma.notification.findMany({
      where: {
        userId,
      },
      orderBy: {
        dateSent: "desc",
      },
      take: limit,
    });
  }

  /**
   * Helper to retrieve all active parishes with their count of pending document requests.
   * @returns {Promise<Array>}
   */
  async findParishesWithPendingCount() {
    return prisma.parish.findMany({
      where: {
        isActive: true,
      },
      include: {
        _count: {
          select: {
            documentRequests: {
              where: {
                status: "PENDING",
              },
            },
          },
        },
      },
    });
  }

  /**
   * Helper to retrieve all active parishes with their active secretaries.
   * @returns {Promise<Array>}
   */
  async findParishesWithSecretaries() {
    return prisma.parish.findMany({
      where: {
        isActive: true,
      },
      include: {
        users: {
          where: {
            role: {
              roleName: "SECRETARY",
            },
            status: "ACTIVE",
          },
        },
      },
    });
  }
}
