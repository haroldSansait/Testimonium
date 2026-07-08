import { ActivityLogRepository } from "../repositories/ActivityLogRepository.js";

const activityLogRepository = new ActivityLogRepository();

export class AuditLogService {
  static async log(userId, action, tx, isSystem = false) {
    if (!userId && !isSystem) {
      console.warn(`[TESTIMONIUM] Attempted to log action "${action}" without a userId.`);
      return;
    }
    try {
      if (tx) {
        await tx.activityLog.create({
          data: { userId, action, isSystem },
        });
      } else {
        await activityLogRepository.create({ userId, action, isSystem });
      }
    } catch (err) {
      console.error("[TESTIMONIUM] Failed to write audit log entry:", err.message);
    }
  }
}
