import { prisma } from "../config/db.js";

export class PushDeviceService {
  constructor(db = prisma) { this.db = db; }

  static validateToken(token) {
    if (typeof token !== "string" || token.length < 20 || token.length > 2048 || !/^[A-Za-z0-9_:.-]+$/.test(token)) {
      throw Object.assign(new Error("Invalid Android device token."), { statusCode: 400 });
    }
  }

  async register(user, token, previousToken) {
    PushDeviceService.validateToken(token);
    if (previousToken) PushDeviceService.validateToken(previousToken);
    if (user?.role !== "PARISHIONER" || user.status !== "ACTIVE" || !user.isVerified) {
      throw Object.assign(new Error("An active, verified parishioner account is required."), { statusCode: 403 });
    }
    // Serializable retries resolve simultaneous registration/account transfers. A new
    // ownership epoch gets a new ID, deleting all queued deliveries to the old owner.
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await this.db.$transaction(async tx => {
          if (previousToken && previousToken !== token) {
            await tx.pushDevice.deleteMany({ where: { token: previousToken, userId: user.id } });
          }
          const existing = await tx.pushDevice.findUnique({ where: { token } });
          if (existing?.userId === user.id) return;
          if (existing) await tx.pushDevice.delete({ where: { id: existing.id } });
          const latest = await tx.notification.aggregate({ _max: { id: true } });
          await tx.pushDevice.create({ data: {
            token, userId: user.id, afterNotificationId: latest._max.id || 0,
          } });
        }, { isolationLevel: "Serializable" });
        return;
      } catch (error) {
        if (attempt === 2 || !["P2034", "P2002"].includes(error.code)) throw error;
      }
    }
  }

  async unregister(userId, token) {
    PushDeviceService.validateToken(token);
    await this.db.pushDevice.deleteMany({ where: { userId, token } });
  }
}
