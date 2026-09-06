import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { validateParishAccess } from "../utils/tenantGuard.js";
import { ConflictHelper, parseManilaDateOnly } from "./ConflictHelper.js";
import { lockPriestForScheduling, normalizePriestId } from "./SchedulingAvailability.js";

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
    const parsedParishId = parseInt(parishId, 10);
    const parsedUserId = userId ? (type === "PRIEST_LEAVE" ? normalizePriestId(userId) : parseInt(userId, 10)) : null;
    const start = parseManilaDateOnly(startDate);
    const end = parseManilaDateOnly(endDate);
    if (!start || !end || start.databaseDate > end.databaseDate) {
      const error = new Error("Invalid availability date range.");
      error.statusCode = 400;
      error.code = "INVALID_DATE_RANGE";
      throw error;
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          if (type === "PRIEST_LEAVE") {
            if (!parsedUserId) {
              const error = new Error("A priest is required for PRIEST_LEAVE.");
              error.statusCode = 400;
              error.code = "PRIEST_REQUIRED";
              throw error;
            }

            await lockPriestForScheduling(tx, parsedUserId);
            const priest = await tx.user.findUnique({
              where: { id: parsedUserId },
              include: { role: true },
            });
            if (!priest || priest.role?.roleName !== "PRIEST") {
              const error = new Error("Selected user must be a priest.");
              error.statusCode = 400;
              error.code = "INVALID_PRIEST_ROLE";
              throw error;
            }
            if (priest.status !== "ACTIVE" || Number(priest.parishId) !== parsedParishId) {
              const error = new Error("Selected priest must be active and belong to this parish.");
              error.statusCode = 403;
              error.code = "FORBIDDEN_PARISH_ASSIGNMENT";
              throw error;
            }

            const endCursor = Date.UTC(end.year, end.month - 1, end.day);
            for (
              let cursor = Date.UTC(start.year, start.month - 1, start.day);
              cursor <= endCursor;
              cursor += 24 * 60 * 60 * 1000
            ) {
              const dateStr = new Date(cursor).toISOString().slice(0, 10);
              const dayStart = new Date(dateStr + "T00:00:00.000+08:00");
              const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
              await ConflictHelper.checkPriestConflict(
                parsedUserId,
                dateStr,
                dayStart,
                dayEnd,
                {
                  tx,
                  actorId,
                  isPriestOwner: Number(actorId) === parsedUserId,
                }
              );
            }
          }

          const record = await tx.parishAvailability.create({
            data: {
              parishId: parsedParishId,
              userId: parsedUserId,
              type,
              startDate: start.databaseDate,
              endDate: end.databaseDate,
              title,
              description,
            },
          });

          await AuditLogService.log(actorId, "Parish Availability Created", tx, false, {
            affectedTable: "parish_availabilities",
            affectedRecordId: record.id,
            parishId: record.parishId,
            newValues: {
              userId: record.userId,
              type: record.type,
              startDate: record.startDate,
              endDate: record.endDate,
              title: record.title,
              description: record.description,
            },
          });

          return record;
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );
    } catch (error) {
      if (
        error?.code === "P2034" ||
        error?.message?.includes("Serialization") ||
        error?.message?.includes("could not serialize")
      ) {
        const concurrencyError = new Error("A concurrent scheduling change occurred. Refresh and retry.");
        concurrencyError.statusCode = 409;
        concurrencyError.code = "SCHEDULE_CONCURRENCY_CONFLICT";
        throw concurrencyError;
      }
      throw error;
    }
  }

  /**
   * Deletes an availability block.
   */
  static async deleteAvailability(id, actorId, req = null) {
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid availability ID.");
      err.statusCode = 400;
      throw err;
    }

    const original = await prisma.parishAvailability.findUnique({
      where: { id: parsedId }
    });

    if (!original) {
      const err = new Error("Availability block not found.");
      err.statusCode = 404;
      throw err;
    }

    if (req) {
      await validateParishAccess(req, original.parishId, "Parish Availability Deletion");
    }

    return prisma.$transaction(
      async (tx) => {
        if (original.type === "PRIEST_LEAVE" && original.userId) {
          await lockPriestForScheduling(tx, original.userId);
        }

        const current = await tx.parishAvailability.findUnique({
          where: { id: parsedId }
        });
        if (!current) {
          const err = new Error("Availability block not found.");
          err.statusCode = 404;
          throw err;
        }

        await tx.parishAvailability.delete({
          where: { id: parsedId },
        });

        await AuditLogService.log(actorId, "Parish Availability Deleted", tx, false, {
          affectedTable: "parish_availabilities",
          affectedRecordId: parsedId,
          parishId: current.parishId,
          previousValues: {
            userId: current.userId,
            type: current.type,
            startDate: current.startDate,
            endDate: current.endDate,
            title: current.title,
          },
        });
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }
}
