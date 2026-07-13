import { DioceseRepository } from "../repositories/DioceseRepository.js";
import { DashboardStatsService } from "./DashboardStatsService.js";

const HIGH_PENDING_REQUEST_THRESHOLD = 30;

export class DioceseService {
  constructor(
    dioceseRepository = new DioceseRepository(),
    dashboardStatsService = new DashboardStatsService()
  ) {
    this.dioceseRepository = dioceseRepository;
    this.dashboardStatsService = dashboardStatsService;
  }

  /**
   * Retrieves and formats stats for the Diocese Dashboard.
   * Consumes the shared statistics service.
   * @returns {Promise<Array>}
   */
  async getStats() {
    return this.dashboardStatsService.getDioceseStats();
  }

  /**
   * Retrieves and formats recent activities for the Diocese Dashboard.
   * @returns {Promise<Array>}
   */
  async getRecentActivity() {
    const logs = await this.dioceseRepository.findRecentActivity(10);
    return logs.map((log) => {
      const actor = log.user ? log.user.fullName : "System";
      return {
        id: String(log.id),
        actor,
        actorInitials: this.getInitials(actor),
        actorColor: this.getActorColor(actor),
        action: log.action,
        parish: log.user && log.user.parish ? log.user.parish.parishName : "Diocese",
        timeAgo: this.formatTimeAgo(log.createdAt),
      };
    });
  }

  /**
   * Retrieves and formats notifications, combining database records with dynamic warning notifications.
   * @param {number} userId
   * @returns {Promise<Array>}
   */
  async getNotifications(userId) {
    // 1. Fetch persistent notifications from database
    const dbNotifs = await this.dioceseRepository.findNotifications(userId, 10);
    const notifications = dbNotifs.map((n) => ({
      id: String(n.id),
      type: this.getNotificationSeverityType(n.title, n.message),
      title: n.title,
      body: n.message,
      timeAgo: this.formatTimeAgo(n.dateSent),
    }));

    // 2. Fetch and generate dynamic metrics-based warnings/notifications
    const [parishVolumes, parishSecretaries] = await Promise.all([
      this.dioceseRepository.findParishesWithPendingCount(),
      this.dioceseRepository.findParishesWithSecretaries(),
    ]);

    // High document volume check
    for (const p of parishVolumes) {
      const pendingCount = p._count?.documentRequests || 0;
      if (pendingCount > HIGH_PENDING_REQUEST_THRESHOLD) {
        notifications.push({
          id: `dyn-volume-${p.id}`,
          type: "warning",
          title: "High Document Volume",
          body: `${p.parishName} has ${pendingCount} pending requests exceeding the ${HIGH_PENDING_REQUEST_THRESHOLD}-request threshold.`,
          timeAgo: "Just now",
        });
      }
    }

    // Unassigned secretary check
    for (const p of parishSecretaries) {
      if (!p.users || p.users.length === 0) {
        notifications.push({
          id: `dyn-sec-${p.id}`,
          type: "warning",
          title: "Unassigned Secretary",
          body: `${p.parishName} has no active secretary assigned.`,
          timeAgo: "Just now",
        });
      }
    }

    // Return the top 10 items
    return notifications.slice(0, 10);
  }

  // HELPER METHODS

  /**
   * Generates initials for a name.
   * @param {string} name
   * @returns {string}
   */
  getInitials(name) {
    if (!name) return "SYS";
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  /**
   * Generates a deterministic background color hex code based on a string name.
   * Uses pleasant colors compatible with the UI.
   * @param {string} name
   * @returns {string}
   */
  getActorColor(name) {
    const colors = [
      "#7B1C2A", // Deep Crimson (TESTIMONIUM Primary style)
      "#1D4ED8", // Blue
      "#B45309", // Amber
      "#065F46", // Emerald
      "#6D28D9", // Purple
      "#0369A1", // Sky Blue
      "#BE185D", // Pink
      "#4D7C0F", // Lime
    ];
    if (!name) return "#4B5563"; // Neutral gray for System
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Dynamically determines severity type based on title/message content.
   * @param {string} title
   * @param {string} message
   * @returns {'info'|'warning'|'success'}
   */
  getNotificationSeverityType(title, message) {
    const text = `${title} ${message}`.toLowerCase();
    if (
      text.includes("exceed") ||
      text.includes("threshold") ||
      text.includes("warning") ||
      text.includes("unassigned") ||
      text.includes("conflict")
    ) {
      return "warning";
    }
    if (
      text.includes("success") ||
      text.includes("onboarded") ||
      text.includes("verified") ||
      text.includes("completed")
    ) {
      return "success";
    }
    return "info";
  }

  /**
   * Generates a relative time string.
   * @param {string|Date} date
   * @returns {string}
   */
  formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffSec < 60) return "Just now";
    if (diffMin < 60) return `${diffMin} mins ago`;
    if (diffHr < 24) return diffHr === 1 ? "1 hr ago" : `${diffHr} hrs ago`;
    return diffDay === 1 ? "1 day ago" : `${diffDay} days ago`;
  }
}
