import { prisma } from "../config/db.js";
import { logger } from "../config/logger.js";

export class AuditLogService {
  static async logOrThrow(userId, action, tx = null, isSystem = false, extra = {}) {
    if (!userId && !isSystem) {
      const err = new Error('Audit entries require a user or an explicit system actor');
      err.code = 'AUDIT_ACTOR_REQUIRED';
      throw err;
    }

    const client = tx || prisma;
    let roleName = extra.role || null;
    let parishId = extra.parishId ? parseInt(extra.parishId, 10) : null;

    if (userId && (!roleName || !parishId)) {
      const user = await client.user.findUnique({
        where: { id: parseInt(userId, 10) },
        include: { role: true },
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
      parishId,
      ipAddress: extra.ipAddress || null,
      userAgent: extra.userAgent || null,
      previousValues: extra.previousValues ? (typeof extra.previousValues === 'string' ? extra.previousValues : JSON.stringify(extra.previousValues)) : null,
      newValues: extra.newValues ? (typeof extra.newValues === 'string' ? extra.newValues : JSON.stringify(extra.newValues)) : null,
      metadata: extra.metadata ? (typeof extra.metadata === 'string' ? extra.metadata : JSON.stringify(extra.metadata)) : null,
    };

    return client.activityLog.create({ data });
  }

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
      await this.logOrThrow(userId, action, tx, isSystem, extra);
      return true;
    } catch (err) {
      logger.error({ err, action }, "[AuditLogService] Failed to write audit log entry");
      return false;
    }
  }
}
