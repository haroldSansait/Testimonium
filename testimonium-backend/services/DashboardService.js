import { NotificationRepository } from "../repositories/NotificationRepository.js";
import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { DashboardStatsService } from "./DashboardStatsService.js";

export class DashboardService {
  constructor(
    scheduleRepository = new ScheduleRepository(),
    notificationRepository = new NotificationRepository(),
    dashboardStatsService = new DashboardStatsService()
  ) {
    this.scheduleRepository = scheduleRepository;
    this.notificationRepository = notificationRepository;
    this.dashboardStatsService = dashboardStatsService;
  }

  /**
   * Returns aggregate counts for the admin dashboard stats panel.
   * Consumes the shared statistics service.
   */
  async getStats(parishId) {
    return this.dashboardStatsService.getParishStats(parishId);
  }

  /**
   * Returns today's upcoming schedule events.
   */
  async getSchedule(parishId) {
    return this.scheduleRepository.findTodayEvents(parishId);
  }

  /**
   * Returns the authenticated user's most recent unread IN_APP notifications.
   * @param {number} userId
   */
  async getAlerts(userId) {
    return this.notificationRepository.findRecentUnreadInApp(userId, 10);
  }
}
