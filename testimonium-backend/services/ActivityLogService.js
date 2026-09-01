import { ActivityLogRepository } from "../repositories/ActivityLogRepository.js";
import { AuditLogService } from "./AuditLogService.js";
import { prisma } from "../config/db.js";

export class ActivityLogService {
  constructor(activityLogRepository = new ActivityLogRepository()) {
    this.activityLogRepository = activityLogRepository;
  }

  /**
   * Returns a paginated list of activity logs with optional filters and active/archived counts.
   */
  async list({
    page = 1,
    limit = 10,
    personnelName,
    action,
    startDate,
    endDate,
    parishId,
    includeArchived = false,
    archivedOnly = false,
    status = "Active",
    role,
  } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    const { data, total } = await this.activityLogRepository.findMany({
      page: parsedPage,
      limit: parsedLimit,
      personnelName,
      action,
      startDate,
      endDate,
      parishId,
      includeArchived,
      archivedOnly,
      status,
      role,
    });

    // Resolve coordinator names for archivedBy IDs
    const archivedByUserIds = [...new Set(data.map((log) => log.archivedBy).filter(Boolean))];
    let userMap = {};
    if (archivedByUserIds.length > 0) {
      const users = await prisma.user.findMany({
        where: { id: { in: archivedByUserIds } },
        select: { id: true, fullName: true },
      });
      userMap = users.reduce((acc, u) => {
        acc[u.id] = u.fullName;
        return acc;
      }, {});
    }

    const itemsMapped = data.map((log) => ({
      ...log,
      archivedByName: log.archivedBy ? (userMap[log.archivedBy] || "Coordinator") : null,
    }));

    const activeCount = await this.activityLogRepository.countActive();
    const archivedCount = await this.activityLogRepository.countArchived();

    return {
      items: itemsMapped,
      total,
      active: activeCount,
      archived: archivedCount,
    };
  }

  async archiveSelected(ids, actorId) {
    if (!ids || ids.length === 0) return;
    await prisma.$transaction(async (tx) => {
      const result = await this.activityLogRepository.archiveMany(ids, actorId);
      await AuditLogService.log(actorId, "Activity Logs Archived", tx, true, {
        metadata: { count: result.count },
      });
    });
  }

  async archiveAll(actorId) {
    await prisma.$transaction(async (tx) => {
      const result = await this.activityLogRepository.archiveAll(actorId);
      await AuditLogService.log(actorId, "Activity Logs Archived", tx, true, {
        metadata: { count: result.count },
      });
    });
  }

  async restoreSelected(ids, actorId) {
    if (!ids || ids.length === 0) return;
    await prisma.$transaction(async (tx) => {
      const result = await this.activityLogRepository.restoreMany(ids);
      await AuditLogService.log(actorId, "Activity Logs Restored", tx, true, {
        metadata: { count: result.count },
      });
    });
  }

  async restoreAll(actorId) {
    await prisma.$transaction(async (tx) => {
      const result = await this.activityLogRepository.restoreAll();
      await AuditLogService.log(actorId, "Activity Logs Restored", tx, true, {
        metadata: { count: result.count },
      });
    });
  }

  async purgeArchived(actorId) {
    const nodeEnv = process.env.NODE_ENV || "development";
    const enablePurge = process.env.ENABLE_ACTIVITY_PURGE === "true";

    if (nodeEnv !== "development" || !enablePurge) {
      const err = new Error("Activity purge is disabled.");
      err.statusCode = 403;
      throw err;
    }

    const retentionDays = parseInt(process.env.ACTIVITY_LOG_RETENTION_DAYS, 10) || 365;

    await prisma.$transaction(async (tx) => {
      const result = await this.activityLogRepository.purgeArchived(retentionDays);
      await AuditLogService.log(actorId, "Activity Logs Purged", tx, true, {
        metadata: { count: result.count, retentionDays },
      });
    });
  }

  async getActionTypes() {
    return this.activityLogRepository.getActionTypes();
  }
}
