import { DocumentRequestRepository } from "../repositories/DocumentRequestRepository.js";
import { NotificationRepository } from "../repositories/NotificationRepository.js";
import { ScheduleRepository } from "../repositories/ScheduleRepository.js";

export class DashboardService {
  constructor(
    documentRequestRepository = new DocumentRequestRepository(),
    scheduleRepository = new ScheduleRepository(),
    notificationRepository = new NotificationRepository(),
  ) {
    this.documentRequestRepository = documentRequestRepository;
    this.scheduleRepository = scheduleRepository;
    this.notificationRepository = notificationRepository;
  }

  /**
   * Returns aggregate counts for the admin dashboard stats panel.
   *
   * NOTE — "Documents Needing Correction":
   * The current DocumentRequestStatus enum does not include a dedicated
   * CORRECTION_NEEDED or RETURNED status. This stat is returned as 0
   * until a dedicated correction status is added to the schema.
   * Dependency: Prisma migration adding DocumentRequestStatus.CORRECTION_NEEDED.
   */
  async getStats() {
    const [docStats, pendingSchedules] = await Promise.all([
      this.documentRequestRepository.countStats(),
      this.scheduleRepository.countPending(),
    ]);

    return {
      pendingDocumentRequests: docStats.pending,
      pendingScheduleRequests: pendingSchedules,
      needingCorrection: 0, // DEPENDENCY: No dedicated correction status in schema (see note above)
      readyForPickup: docStats.readyForPickup,
    };
  }

  /**
   * Returns today's upcoming schedule events.
   */
  async getSchedule() {
    return this.scheduleRepository.findTodayEvents();
  }

  /**
   * Returns the authenticated user's most recent unread IN_APP notifications.
   * @param {number} userId
   */
  async getAlerts(userId) {
    return this.notificationRepository.findRecentUnreadInApp(userId, 10);
  }
}
