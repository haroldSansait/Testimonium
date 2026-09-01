import { prisma } from "../config/db.js";
import { CANONICAL_ACTION_TYPES, LEGACY_ACTION_PATTERNS } from "../config/canonicalActions.js";

export class ActivityLogRepository {
  /**
   * Builds an action filter that matches canonical actions as well as known legacy historical patterns.
   */
  _buildActionCondition(action) {
    if (!action || action === "All Actions") {
      return null;
    }

    const legacyPatterns = LEGACY_ACTION_PATTERNS[action];
    if (!legacyPatterns || legacyPatterns.length === 0) {
      return { action };
    }

    const orConditions = [{ action }];
    for (const pattern of legacyPatterns) {
      if (pattern.type === "startsWith") {
        orConditions.push({ action: { startsWith: pattern.value } });
      } else if (pattern.type === "exact") {
        orConditions.push({ action: pattern.value });
      } else if (pattern.type === "contains") {
        orConditions.push({ action: { contains: pattern.value } });
      }
    }

    return { OR: orConditions };
  }

  /**
   * Paginated list of activity logs with optional filters.
   */
  async findMany({
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
    const skip = (page - 1) * limit;
    const andConditions = [];

    if (personnelName || parishId || role) {
      const userCondition = {};
      if (personnelName) {
        userCondition.fullName = { contains: personnelName, mode: "insensitive" };
      }
      if (parishId) {
        userCondition.parishId = parseInt(parishId, 10);
      }
      if (role && role !== "All Roles") {
        let prismaRole = role;
        if (role === "Diocese Coordinator") prismaRole = "DIOCESE_COORDINATOR";
        else if (role === "Priest") prismaRole = "PRIEST";
        else if (role === "Secretary") prismaRole = "SECRETARY";
        userCondition.role = {
          roleName: prismaRole,
        };
      }
      andConditions.push({ user: userCondition });
    }

    if (action && action !== "All Actions") {
      const actionCondition = this._buildActionCondition(action);
      if (actionCondition) {
        andConditions.push(actionCondition);
      }
    }

    if (startDate || endDate) {
      const dateCondition = {};
      if (startDate) {
        dateCondition.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setDate(end.getDate() + 1);
        dateCondition.lt = end;
      }
      andConditions.push({ createdAt: dateCondition });
    }

    // Soft archive filters
    if (archivedOnly || status === "Archived") {
      andConditions.push({ archivedAt: { not: null } });
    } else if (status === "Active" && !includeArchived) {
      andConditions.push({ archivedAt: null });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const [data, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, email: true, role: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.activityLog.count({ where }),
    ]);

    return { data, total };
  }

  async create({ userId, action, isSystem = false }) {
    return prisma.activityLog.create({
      data: {
        userId,
        action,
        isSystem,
      },
    });
  }

  async archiveMany(ids, actorId) {
    return prisma.activityLog.updateMany({
      where: {
        id: { in: ids.map((id) => parseInt(id, 10)) },
        isSystem: false,
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        archivedBy: actorId,
      },
    });
  }

  async archiveAll(actorId) {
    return prisma.activityLog.updateMany({
      where: {
        isSystem: false,
        archivedAt: null,
      },
      data: {
        archivedAt: new Date(),
        archivedBy: actorId,
      },
    });
  }

  async restoreMany(ids) {
    return prisma.activityLog.updateMany({
      where: {
        id: { in: ids.map((id) => parseInt(id, 10)) },
        isSystem: false,
        archivedAt: { not: null },
      },
      data: {
        archivedAt: null,
        archivedBy: null,
      },
    });
  }

  async restoreAll() {
    return prisma.activityLog.updateMany({
      where: {
        isSystem: false,
        archivedAt: { not: null },
      },
      data: {
        archivedAt: null,
        archivedBy: null,
      },
    });
  }

  async countActive() {
    return prisma.activityLog.count({
      where: {
        archivedAt: null,
      },
    });
  }

  async countArchived() {
    return prisma.activityLog.count({
      where: {
        archivedAt: { not: null },
      },
    });
  }

  async purgeArchived(retentionDays) {
    const dateThreshold = new Date();
    dateThreshold.setDate(dateThreshold.getDate() - retentionDays);
    return prisma.activityLog.deleteMany({
      where: {
        archivedAt: { lte: dateThreshold },
      },
    });
  }

  async getActionTypes() {
    return [...CANONICAL_ACTION_TYPES];
  }
}
