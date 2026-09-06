import { prisma } from "../config/db.js";
import { ConflictHelper, getManilaDateString } from "./ConflictHelper.js";
import { lockPriestForScheduling, normalizePriestId } from "./SchedulingAvailability.js";

export class PriestPersonalScheduleService {
  /**
   * Lists personal schedule commitments for the authenticated priest.
   * Private to the priest owner.
   */
  async list(priestId, { startDate, endDate } = {}) {
    const parsedPriestId = normalizePriestId(priestId);

    const where = { priestId: parsedPriestId };

    if (startDate || endDate) {
      where.AND = [];
      if (startDate) {
        where.AND.push({ endAt: { gt: new Date(startDate) } });
      }
      if (endDate) {
        where.AND.push({ startAt: { lt: new Date(endDate) } });
      }
    }

    return prisma.priestPersonalSchedule.findMany({
      where,
      orderBy: { startAt: "asc" },
    });
  }

  /**
   * Retrieves a single personal schedule item.
   */
  async getById(id, priestId) {
    const parsedPriestId = normalizePriestId(priestId);
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    const item = await prisma.priestPersonalSchedule.findUnique({
      where: { id: parsedId },
    });

    if (!item) {
      const err = new Error("Personal schedule not found.");
      err.statusCode = 404;
      err.code = "PERSONAL_SCHEDULE_NOT_FOUND";
      throw err;
    }

    if (item.priestId !== parsedPriestId) {
      const err = new Error("You do not have permission to view this personal schedule.");
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      throw err;
    }

    return item;
  }

  /**
   * Creates a new timed personal schedule commitment.
   * Acquires the stable priest scheduling lock and checks ALL 5 conflict sources.
   */
  async create(priestId, { title, notes, startAt, endAt }) {
    const parsedPriestId = normalizePriestId(priestId);

    const startDate = new Date(startAt);
    const endDate = new Date(endAt);

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      const err = new Error("Invalid start or end datetime.");
      err.statusCode = 400;
      err.code = "INVALID_DATETIME";
      throw err;
    }

    if (endDate.getTime() <= startDate.getTime()) {
      const err = new Error("endAt must be strictly after startAt.");
      err.statusCode = 400;
      err.code = "INVALID_INTERVAL";
      throw err;
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          // 1. Stable priest-level scheduling lock
          await lockPriestForScheduling(tx, parsedPriestId);

          // 2. Authoritative conflict check across all 5 sources
          const dateStr = getManilaDateString(startDate);
          await ConflictHelper.checkPriestConflict(
            parsedPriestId,
            dateStr,
            startDate,
            endDate,
            {
              tx,
              actorId: parsedPriestId,
              isPriestOwner: true,
            }
          );

          // 3. Insert record
          return tx.priestPersonalSchedule.create({
            data: {
              priestId: parsedPriestId,
              title: title.trim(),
              notes: notes ? notes.trim() : null,
              startAt: startDate,
              endAt: endDate,
              version: 1,
            },
          });
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );
    } catch (err) {
      if (
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize")
      ) {
        const conflictErr = new Error("A concurrent scheduling conflict occurred. Please retry.");
        conflictErr.statusCode = 409;
        conflictErr.code = "SCHEDULE_CONCURRENCY_CONFLICT";
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Updates an existing personal schedule commitment.
   * Acquires the stable priest lock, verifies version, and checks conflicts excluding self.
   */
  async update(id, priestId, { title, notes, startAt, endAt, expectedVersion }) {
    const parsedPriestId = normalizePriestId(priestId);
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    if (!Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) < 1) {
      const err = new Error("expectedVersion is required to update a personal schedule.");
      err.statusCode = 400;
      err.code = "EXPECTED_VERSION_REQUIRED";
      throw err;
    }

    try {
      return await prisma.$transaction(
        async (tx) => {
          // 1. Stable priest-level scheduling lock
          await lockPriestForScheduling(tx, parsedPriestId);

          // 2. Authoritative re-read
          const current = await tx.priestPersonalSchedule.findUnique({
            where: { id: parsedId },
          });

          if (!current) {
            const err = new Error("Personal schedule not found.");
            err.statusCode = 404;
            err.code = "PERSONAL_SCHEDULE_NOT_FOUND";
            throw err;
          }

          if (current.priestId !== parsedPriestId) {
            const err = new Error("You do not have permission to modify this personal schedule.");
            err.statusCode = 403;
            err.code = "FORBIDDEN";
            throw err;
          }

          // 3. Optimistic version check
          if (current.version !== Number(expectedVersion)) {
            const err = new Error("Personal schedule was modified by another operation. Please refresh and retry.");
            err.statusCode = 409;
            err.code = "SCHEDULE_CONCURRENCY_CONFLICT";
            throw err;
          }

          const effectiveStartAt = startAt ? new Date(startAt) : current.startAt;
          const effectiveEndAt = endAt ? new Date(endAt) : current.endAt;

          if (effectiveEndAt.getTime() <= effectiveStartAt.getTime()) {
            const err = new Error("endAt must be strictly after startAt.");
            err.statusCode = 400;
            err.code = "INVALID_INTERVAL";
            throw err;
          }

          // 4. Authoritative conflict check excluding current record
          const dateStr = getManilaDateString(effectiveStartAt);
          await ConflictHelper.checkPriestConflict(
            parsedPriestId,
            dateStr,
            effectiveStartAt,
            effectiveEndAt,
            {
              excludePersonalId: parsedId,
              tx,
              actorId: parsedPriestId,
              isPriestOwner: true,
            }
          );

          // 5. Update record and increment version
          return tx.priestPersonalSchedule.update({
            where: { id: parsedId },
            data: {
              title: title !== undefined ? title.trim() : undefined,
              notes: notes !== undefined ? (notes ? notes.trim() : null) : undefined,
              startAt: effectiveStartAt,
              endAt: effectiveEndAt,
              version: { increment: 1 },
            },
          });
        },
        {
          isolationLevel: "Serializable",
          maxWait: 5000,
          timeout: 15000,
        }
      );
    } catch (err) {
      if (
        err?.code === "P2034" ||
        err?.message?.includes("Serialization") ||
        err?.message?.includes("could not serialize")
      ) {
        const conflictErr = new Error("A concurrent scheduling conflict occurred. Please retry.");
        conflictErr.statusCode = 409;
        conflictErr.code = "SCHEDULE_CONCURRENCY_CONFLICT";
        throw conflictErr;
      }
      throw err;
    }
  }

  /**
   * Deletes a personal schedule item.
   * Acquires the stable priest lock and verifies version before removal.
   */
  async delete(id, priestId, expectedVersion) {
    const parsedPriestId = normalizePriestId(priestId);
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      const err = new Error("Invalid ID.");
      err.statusCode = 400;
      err.code = "INVALID_ID";
      throw err;
    }

    if (!Number.isInteger(Number(expectedVersion)) || Number(expectedVersion) < 1) {
      const err = new Error("expectedVersion is required to delete a personal schedule.");
      err.statusCode = 400;
      err.code = "EXPECTED_VERSION_REQUIRED";
      throw err;
    }

    return prisma.$transaction(
      async (tx) => {
        // 1. Stable priest lock
        await lockPriestForScheduling(tx, parsedPriestId);

        // 2. Authoritative re-read
        const current = await tx.priestPersonalSchedule.findUnique({
          where: { id: parsedId },
        });

        if (!current) {
          const err = new Error("Personal schedule not found.");
          err.statusCode = 404;
          err.code = "PERSONAL_SCHEDULE_NOT_FOUND";
          throw err;
        }

        if (current.priestId !== parsedPriestId) {
          const err = new Error("You do not have permission to delete this personal schedule.");
          err.statusCode = 403;
          err.code = "FORBIDDEN";
          throw err;
        }

        if (current.version !== Number(expectedVersion)) {
          const err = new Error("Personal schedule was modified by another operation. Please refresh and retry.");
          err.statusCode = 409;
          err.code = "SCHEDULE_CONCURRENCY_CONFLICT";
          throw err;
        }

        await tx.priestPersonalSchedule.delete({
          where: { id: parsedId },
        });

        return { success: true, id: parsedId };
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }
}
