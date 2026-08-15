import { prisma } from "../config/db.js";

export class ActivityLogRepository {
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

    if (action) {
      if (action === "Staff Assignment") {
        andConditions.push({
          OR: [
            { action: { contains: "Priest", mode: "insensitive" } },
            { action: { contains: "Secretary", mode: "insensitive" } },
          ],
        });
      } else if (action === "Authentication") {
        andConditions.push({
          OR: [
            { action: { contains: "Login", mode: "insensitive" } },
            { action: { contains: "Logout", mode: "insensitive" } },
          ],
        });
      } else if (action === "Activity Logs") {
        andConditions.push({
          OR: [
            { action: { contains: "archived", mode: "insensitive" } },
            { action: { contains: "restored", mode: "insensitive" } },
            { action: { contains: "purged", mode: "insensitive" } },
          ],
        });
      } else if (action === "Document Management") {
        andConditions.push({
          OR: [
            { action: { contains: "document", mode: "insensitive" } },
            { action: { contains: "schedule", mode: "insensitive" } },
          ],
        });
      } else if (action === "User Management") {
        andConditions.push({
          OR: [
            { action: { contains: "User", mode: "insensitive" } },
            { action: { contains: "Reset", mode: "insensitive" } },
          ],
        });
      } else if (action === "Parish Management") {
        andConditions.push({
          action: { contains: "Parish", mode: "insensitive" },
        });
      } else {
        andConditions.push({ action: { contains: action, mode: "insensitive" } });
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
    const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    return prisma.activityLog.updateMany({
      where: {
        id: { in: numericIds },
        isSystem: false,
        NOT: [
          { action: { contains: "Initial database migration", mode: "insensitive" } },
          { action: { contains: "System initialization", mode: "insensitive" } },
          { action: { contains: "First Diocese Coordinator", mode: "insensitive" } },
        ],
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
        archivedAt: null,
        isSystem: false,
        NOT: [
          { action: { contains: "Initial database migration", mode: "insensitive" } },
          { action: { contains: "System initialization", mode: "insensitive" } },
          { action: { contains: "First Diocese Coordinator", mode: "insensitive" } },
        ],
      },
      data: {
        archivedAt: new Date(),
        archivedBy: actorId,
      },
    });
  }

  async restoreMany(ids) {
    const numericIds = ids.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    return prisma.activityLog.updateMany({
      where: {
        id: { in: numericIds },
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
    const records = await prisma.activityLog.findMany({
      select: { action: true },
      distinct: ['action'],
      where: {
        action: { not: '' },
      },
    });

    const canonicalActions = [
      'User Login',
      'User Logout',
      'Email Verified',
      'Profile Completed',
      'Profile Updated',
      'Google Existing User',
      'Admin Email Verification Bypassed',
      'Admin Verification Bypassed',
      'Password Reset',
      'User Created',
      'User Updated',
      'User Disabled',
      'User Enabled',
      'Role Updated',
      'Parish Created',
      'Parish Updated',
      'Parish Archived',
      'Parish Restored',
      'Payment QR uploaded',
      'Payment QR deleted',
      'Available Documents Updated',
      'Terms Accepted',
      'Privacy Accepted',
    ];

    const dbActions = records.map((r) => r.action).filter(Boolean);
    const combined = Array.from(new Set([...canonicalActions, ...dbActions])).sort((a, b) =>
      a.localeCompare(b)
    );
    return combined;
  }
}
