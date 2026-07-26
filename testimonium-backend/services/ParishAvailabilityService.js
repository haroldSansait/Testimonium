import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";

export class ParishAvailabilityService {
  /**
   * Retrieves availability records for a parish.
   */
  static async getAvailabilities(parishId, startDate, endDate) {
    const where = {};
    if (parishId) {
      where.parishId = parseInt(parishId, 10);
    }
    if (startDate && endDate) {
      where.OR = [
        {
          startDate: { lte: new Date(endDate) },
          endDate: { gte: new Date(startDate) },
        },
      ];
    }

    return prisma.parishAvailability.findMany({
      where,
      include: {
        parish: { select: { parishName: true } },
        user: { select: { fullName: true, email: true } },
      },
      orderBy: { startDate: "asc" },
    });
  }

  /**
   * Creates a new availability block (office closure, leave, etc.).
   */
  static async createAvailability({ parishId, userId, type, startDate, endDate, title, description }, actorId) {
    const record = await prisma.parishAvailability.create({
      data: {
        parishId: parseInt(parishId, 10),
        userId: userId ? parseInt(userId, 10) : null,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        title,
        description,
      },
    });

    await AuditLogService.log(actorId, `Created leave/availability block: ${title} (${type})`, null, false, {
      affectedTable: "ParishAvailability",
      affectedRecordId: record.id,
      parishId: record.parishId,
      newValues: { userId, type, startDate, endDate, title, description }
    });

    return record;
  }

  /**
   * Deletes an availability block.
   */
  static async deleteAvailability(id, actorId) {
    const parsedId = parseInt(id, 10);
    const original = await prisma.parishAvailability.findUnique({
      where: { id: parsedId }
    });

    if (!original) {
      const err = new Error("Availability block not found.");
      err.statusCode = 404;
      throw err;
    }

    await prisma.parishAvailability.delete({
      where: { id: parsedId },
    });

    await AuditLogService.log(actorId, `Deleted leave/availability block #${id}: ${original.title}`, null, false, {
      affectedTable: "ParishAvailability",
      affectedRecordId: parsedId,
      parishId: original.parishId,
      previousValues: original
    });
  }
}
