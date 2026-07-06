import { NotificationRepository } from "../repositories/NotificationRepository.js";

export class NotificationService {
  constructor(notificationRepository = new NotificationRepository()) {
    this.notificationRepository = notificationRepository;
  }

  /**
   * Returns all notifications for the authenticated user.
   * @param {number} userId
   */
  async list(userId) {
    return this.notificationRepository.findByUserId(userId);
  }

  /**
   * Marks a single notification as read, enforcing ownership.
   * @param {number} id
   * @param {number} userId
   */
  async markOneRead(id, userId) {
    const notification = await this.notificationRepository.markOneAsRead(id, userId);

    if (!notification) {
      const error = new Error("Notification not found or does not belong to this user.");
      error.statusCode = 404;
      throw error;
    }

    return notification;
  }

  /**
   * Marks all of the user's unread notifications as read.
   * @param {number} userId
   */
  async markAllRead(userId) {
    return this.notificationRepository.markAllAsRead(userId);
  }
}
