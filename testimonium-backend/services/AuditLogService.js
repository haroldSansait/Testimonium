import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";

export class AuditLogService {
  /**
   * Write an audit log entry.
   * Keeps backward compatibility with log(userId, action, tx, isSystem)
   */
  static async log(userId, action, tx = null, isSystem = false, extra = {}) {
    if (!userId && !isSystem) {
      logger.warn({ action }, '[AuditLogService] Attempted to log action without a userId');
      return;
    }
    try {
      const client = tx || prisma;
      
      // If we don't have the user's role/parish, we can fetch it if userId is provided
      let roleName = extra.role || null;
      let parishId = extra.parishId ? parseInt(extra.parishId, 10) : null;

      if (userId && (!roleName || !parishId)) {
        const user = await client.user.findUnique({
          where: { id: parseInt(userId, 10) },
          include: { role: true }
        });
        if (user) {
          if (!roleName) roleName = user.role?.roleName || null;
          if (!parishId) parishId = user.parishId || null;
        }
      }

      const data = {
        userId: userId ? parseInt(userId, 10) : null,
        action,
        isSystem,
        affectedTable: extra.affectedTable || null,
        affectedRecordId: extra.affectedRecordId ? parseInt(extra.affectedRecordId, 10) : null,
        role: roleName,
        parishId: parishId,
        ipAddress: extra.ipAddress || null,
        userAgent: extra.userAgent || null,
        previousValues: extra.previousValues ? (typeof extra.previousValues === 'string' ? extra.previousValues : JSON.stringify(extra.previousValues)) : null,
        newValues: extra.newValues ? (typeof extra.newValues === 'string' ? extra.newValues : JSON.stringify(extra.newValues)) : null,
        metadata: extra.metadata ? (typeof extra.metadata === 'string' ? extra.metadata : JSON.stringify(extra.metadata)) : null,
      };

      await client.activityLog.create({ data });
    } catch (err) {
      logger.error({ err, action }, "[AuditLogService] Failed to write audit log entry");
    }
  }
}

