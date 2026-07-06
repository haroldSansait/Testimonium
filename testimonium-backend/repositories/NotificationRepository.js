import { prisma } from "../config/db.js";

export class NotificationRepository {
  /**
   * Returns all notifications for a specific user, newest first.
   * @param {number} userId
   */
  async findByUserId(userId) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { dateSent: "desc" },
    });
  }

  /**
   * Marks a single notification as read.
   * Includes a userId guard to prevent cross-user access.
   * @param {number} id
   * @param {number} userId
   */
  async markOneAsRead(id, userId) {
    // Verify the notification belongs to this user before updating
    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      return null;
    }

    return prisma.notification.update({
      where: { id },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Marks all unread notifications for a user as read.
   * @param {number} userId
   */
  async markAllAsRead(userId) {
    return prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });
  }

  /**
   * Returns the most recent unread IN_APP notifications for a user.
   * Used by the dashboard alerts endpoint.
   * @param {number} userId
   * @param {number} limit
   */
  async findRecentUnreadInApp(userId, limit = 10) {
    return prisma.notification.findMany({
      where: {
        userId,
        type: "IN_APP",
        isRead: false,
      },
      orderBy: { dateSent: "desc" },
      take: limit,
    });
  }
}
