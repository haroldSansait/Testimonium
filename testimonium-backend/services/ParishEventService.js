import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { ConflictHelper } from "./ConflictHelper.js";

export class ParishEventService {
  async createEvent(parishId, data, actorId) {
    const parsedParishId = parseInt(parishId, 10);

    let start = null;
    let end = null;
    if (data.assignedPriestId && data.startTime && data.endTime) {
      const combine = (d, timeStr) => {
        try {
          const temp = new Date(d);
          let [hourMin, period] = timeStr.split(" ");
          let [hours, minutes] = hourMin.split(":").map(Number);
          if (period === "PM" && hours < 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          temp.setHours(hours, minutes, 0, 0);
          return temp;
        } catch {
          return null;
        }
      };
      start = combine(data.eventDate, data.startTime);
      end = combine(data.eventDate, data.endTime);
    }

    if (data.assignedPriestId) {
      await ConflictHelper.checkPriestConflict(data.assignedPriestId, data.eventDate, start, end, { actorId });
    }

    const event = await prisma.parishEvent.create({
      data: {
        parishId: parsedParishId,
        createdById: actorId ? parseInt(actorId, 10) : null,
        title: data.title,
        eventType: data.eventType,
        description: data.description || null,
        location: data.location || null,
        eventDate: new Date(data.eventDate),
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        assignedPriestId: data.assignedPriestId ? parseInt(data.assignedPriestId, 10) : null,
        isActive: true,
      },
      include: {
        assignedPriest: { select: { id: true, fullName: true } }
      }
    });

    await AuditLogService.log(actorId, `Created new parish event: ${data.title}`, null, false, {
      affectedTable: "ParishEvent",
      affectedRecordId: event.id,
      parishId: parsedParishId,
      newValues: data
    });

    return event;
  }

  async getEvents(parishId, year, month) {
    const parsedParishId = parseInt(parishId, 10);
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    const startOfMonth = new Date(parsedYear, parsedMonth - 1, 1);
    const startOfNextMonth = new Date(parsedYear, parsedMonth, 1);

    return prisma.parishEvent.findMany({
      where: {
        parishId: parsedParishId,
        isActive: true,
        eventDate: {
          gte: startOfMonth,
          lt: startOfNextMonth
        }
      },
      include: {
        assignedPriest: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } }
      },
      orderBy: { eventDate: "asc" }
    });
  }

  async updateEvent(id, data, actorId) {
    const parsedId = parseInt(id, 10);
    const original = await prisma.parishEvent.findUnique({
      where: { id: parsedId }
    });

    if (!original) {
      const err = new Error("Parish event not found.");
      err.statusCode = 404;
      throw err;
    }

    const priestId = data.assignedPriestId !== undefined ? data.assignedPriestId : original.assignedPriestId;
    const date = data.eventDate || original.eventDate;
    const startTime = data.startTime !== undefined ? data.startTime : original.startTime;
    const endTime = data.endTime !== undefined ? data.endTime : original.endTime;

    let start = null;
    let end = null;
    if (priestId && startTime && endTime) {
      const combine = (d, timeStr) => {
        try {
          const temp = new Date(d);
          let [hourMin, period] = timeStr.split(" ");
          let [hours, minutes] = hourMin.split(":").map(Number);
          if (period === "PM" && hours < 12) hours += 12;
          if (period === "AM" && hours === 12) hours = 0;
          temp.setHours(hours, minutes, 0, 0);
          return temp;
        } catch {
          return null;
        }
      };
      start = combine(date, startTime);
      end = combine(date, endTime);
    }

    if (priestId) {
      await ConflictHelper.checkPriestConflict(priestId, date, start, end, { excludeEventId: id, actorId });
    }

    const event = await prisma.parishEvent.update({
      where: { id: parsedId },
      data: {
        title: data.title,
        eventType: data.eventType,
        description: data.description !== undefined ? data.description : original.description,
        location: data.location !== undefined ? data.location : original.location,
        eventDate: data.eventDate ? new Date(data.eventDate) : original.eventDate,
        startTime: data.startTime !== undefined ? data.startTime : original.startTime,
        endTime: data.endTime !== undefined ? data.endTime : original.endTime,
        assignedPriestId: data.assignedPriestId !== undefined ? (data.assignedPriestId ? parseInt(data.assignedPriestId, 10) : null) : original.assignedPriestId,
      },
      include: {
        assignedPriest: { select: { id: true, fullName: true } }
      }
    });

    await AuditLogService.log(actorId, `Updated parish event #${id}: ${event.title}`, null, false, {
      affectedTable: "ParishEvent",
      affectedRecordId: parsedId,
      parishId: event.parishId,
      previousValues: original,
      newValues: data
    });

    return event;
  }

  async deleteEvent(id, actorId) {
    const parsedId = parseInt(id, 10);
    const original = await prisma.parishEvent.findUnique({
      where: { id: parsedId }
    });

    if (!original) {
      const err = new Error("Parish event not found.");
      err.statusCode = 404;
      throw err;
    }

    await prisma.parishEvent.update({
      where: { id: parsedId },
      data: { isActive: false }
    });

    await AuditLogService.log(actorId, `Deleted parish event #${id}: ${original.title}`, null, false, {
      affectedTable: "ParishEvent",
      affectedRecordId: parsedId,
      parishId: original.parishId,
      previousValues: { isActive: true },
      newValues: { isActive: false }
    });
  }
}
