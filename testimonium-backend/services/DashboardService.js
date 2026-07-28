import { NotificationRepository } from "../repositories/NotificationRepository.js";
import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { DashboardStatsService } from "./DashboardStatsService.js";
import { prisma } from "../config/db.js";

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
    // 1. Fetch today's schedule requests
    const schedules = await this.scheduleRepository.findTodayEvents(parishId);

    // 2. Fetch today's parish events
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const eventWhere = {
      isActive: true,
      eventDate: {
        gte: startOfDay,
        lt: endOfDay,
      },
    };

    if (parishId) {
      eventWhere.parishId = parseInt(parishId, 10);
    }

    const parishEvents = await prisma.parishEvent.findMany({
      where: eventWhere,
      include: {
        parish: { select: { id: true, parishName: true } },
        assignedPriest: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } },
      },
    });

    // 3. Map parish events to schedule DTO shape:
    // id, eventType, displayTitle, requestedDate, startDatetime, endDatetime, status, user, parish, processedBy, remarks
    const mappedEvents = parishEvents.map((e) => {
      const combine = (d, timeStr) => {
        try {
          const temp = new Date(d);
          let [hourMin, period] = timeStr.split(" ");
          let [hours, minutes] = hourMin.split(":").map(Number);
          if (period === "PM" && hours < 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          temp.setHours(hours, minutes, 0, 0);
          return temp;
        } catch {
          return null;
        }
      };

      const start = e.startTime ? combine(e.eventDate, e.startTime) : null;
      const end = e.endTime ? combine(e.eventDate, e.endTime) : null;

      return {
        id: e.id + 100000, // Safe offset to prevent key conflicts with schedules
        eventType: e.eventType,
        displayTitle: e.title,
        requestedDate: e.eventDate,
        startDatetime: start,
        endDatetime: end,
        status: e.priestResponseStatus === "REJECTED" ? "CANCELLED" : "CONFIRMED",
        user: { fullName: e.createdBy?.fullName || "Staff" },
        parish: { parishName: e.parish?.parishName || "Main Church" },
        processedBy: { fullName: e.assignedPriest?.fullName || "TBD" },
        remarks: e.description || "",
      };
    });

    return [...schedules, ...mappedEvents];
  }

  /**
   * Returns the authenticated user's most recent unread IN_APP notifications.
   * @param {number} userId
   */
  async getAlerts(userId) {
    return this.notificationRepository.findRecentUnreadInApp(userId, 10);
  }
}
