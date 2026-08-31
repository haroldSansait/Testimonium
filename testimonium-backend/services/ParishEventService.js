import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { ConflictHelper } from "./ConflictHelper.js";
import { PriestAssignmentHandler } from "./PriestAssignmentHandler.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";

function combineDateAndTime(date, timeStr) {
  try {
    const d = new Date(date);
    let [hourMin, period] = timeStr.split(" ");
    let [hours, minutes] = hourMin.split(":").map(Number);
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    d.setUTCHours(hours, minutes, 0, 0);
    return d;
  } catch (err) {
    return null;
  }
}

function formatTime(date) {
  const hours24 = date.getUTCHours();
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const period = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 || 12;
  return `${String(hours12).padStart(2, "0")}:${minutes} ${period}`;
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function toPublicEventDto(event) {
  return {
    id: event.id,
    parishId: event.parishId,
    title: event.title,
    eventType: event.eventType,
    description: event.description,
    location: event.location,
    eventDate: event.eventDate,
    startTime: event.startTime,
    endTime: event.endTime,
    parish: event.parish ? {
      id: event.parish.id,
      parishName: event.parish.parishName
    } : undefined
  };
}

function normalizeVisibility(value, fallback = "PUBLIC") {
  const visibility = value ?? fallback;
  if (!["PUBLIC", "PARISH_PRIVATE"].includes(visibility)) {
    const error = new Error("Event visibility must be PUBLIC or PARISH_PRIVATE.");
    error.statusCode = 400;
    error.code = "INVALID_EVENT_VISIBILITY";
    throw error;
  }
  return visibility;
}

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
        visibility: normalizeVisibility(data.visibility),
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

    // Notify assigned priest of their new assignment (GENERAL type — no PARISH_EVENT ref in schema).
    if (event.assignedPriestId) {
      await NotificationDispatcher._persist(
        [{
          userId: event.assignedPriestId,
          title: "New Pastoral Assignment",
          message: `You have been assigned to lead the "${event.title}" event at the parish.`,
          type: "IN_APP",
          referenceType: "GENERAL",
          referenceId: null,
        }],
        prisma
      );
    }

    return event;
  }

  async getEvents(parishId, year, month, { publicOnly = false } = {}) {
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);
    if (
      !Number.isInteger(parsedYear) || parsedYear < 2000 || parsedYear > 2100 ||
      !Number.isInteger(parsedMonth) || parsedMonth < 1 || parsedMonth > 12
    ) {
      const error = new Error("Invalid year or month. year must be 2000-2100 and month must be 1-12.");
      error.statusCode = 400;
      error.code = "INVALID_EVENT_DATE_RANGE";
      throw error;
    }

    const startOfMonth = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1));
    const startOfNextMonth = new Date(Date.UTC(parsedYear, parsedMonth, 1));

    const whereClause = {
      isActive: true,
      ...(publicOnly ? { visibility: "PUBLIC" } : {}),
      eventDate: {
        gte: startOfMonth,
        lt: startOfNextMonth
      }
    };

    if (parishId !== "all") {
      const parsedParishId = parseInt(parishId, 10);
      if (!isNaN(parsedParishId)) {
        whereClause.parishId = parsedParishId;
      }
    }

    const dbParishEvents = await prisma.parishEvent.findMany({
      where: whereClause,
      include: {
        parish: { select: { id: true, parishName: true } },
        assignedPriest: { select: { id: true, fullName: true } },
        createdBy: { select: { id: true, fullName: true } }
      },
      orderBy: { eventDate: "asc" }
    });

    // Fetch and expand MassScheduleTemplates
    const templateWhere = { isActive: true };
    if (parishId !== "all") {
      const parsedParishId = parseInt(parishId, 10);
      if (!isNaN(parsedParishId)) {
        templateWhere.parishId = parsedParishId;
      }
    }

    const templates = await prisma.massScheduleTemplate.findMany({
      where: templateWhere,
      include: {
        parish: { select: { id: true, parishName: true } },
        assignedPriest: { select: { id: true, fullName: true } }
      }
    });

    const expandedMasses = [];
    const numDays = new Date(parsedYear, parsedMonth, 0).getDate();
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

    for (let day = 1; day <= numDays; day++) {
      const date = new Date(Date.UTC(parsedYear, parsedMonth - 1, day));
      const dayOfWeek = date.getUTCDay();
      const currentDayName = dayNames[dayOfWeek];

      const dailyTemplates = templates.filter((t) => {
        if (t.dayType === currentDayName) return true;
        if (t.dayType === "WEEKDAY" && (currentDayName === "WEDNESDAY" || currentDayName === "FRIDAY")) return true;
        return false;
      });

      for (const t of dailyTemplates) {
        const start = combineDateAndTime(date, t.timeSlot);
        const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
        
        expandedMasses.push({
          id: `mass-t-${t.id}-${formatDateOnly(date)}`,
          parishId: t.parishId,
          title: t.label || "Holy Mass",
          eventType: "PRIVATE_MASS", // matches 'Holy Mass' category on frontend mapping
          description: `Regular Mass schedule - ${t.dayType} at ${t.timeSlot}.`,
          location: "Parish Sanctuary",
          eventDate: date,
          startTime: t.timeSlot,
          endTime: end ? formatTime(end) : t.timeSlot,
          assignedPriestId: t.assignedPriestId,
          isActive: true,
          parish: t.parish,
          assignedPriest: t.assignedPriest
        });
      }
    }

    const combined = [
      ...dbParishEvents,
      ...expandedMasses
    ];

    combined.sort((a, b) => {
      const dateA = new Date(a.eventDate);
      const dateB = new Date(b.eventDate);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
      return (a.startTime || "").localeCompare(b.startTime || "");
    });

    const parishIds = [...new Set(combined.map((item) => item.parishId).filter(Boolean))];
    const secretaries = parishIds.length
      ? await prisma.user.findMany({
          where: {
            parishId: { in: parishIds },
            status: "ACTIVE",
            role: { roleName: "SECRETARY" },
          },
          select: { parishId: true, fullName: true, contactNumber: true, isAssistant: true },
          orderBy: [{ isAssistant: "asc" }, { id: "asc" }],
        })
      : [];
    const secretaryByParish = new Map();
    for (const secretary of secretaries) {
      if (!secretaryByParish.has(secretary.parishId)) {
        secretaryByParish.set(secretary.parishId, secretary);
      }
    }

    const combinedWithSecretaries = combined.map((item) => {
      const secretary = secretaryByParish.get(item.parishId);
      return {
        ...item,
        secretaryName: secretary?.fullName || null,
        secretaryContact: secretary?.contactNumber || null,
      };
    });

    return combinedWithSecretaries;
  }

  async getPublicEvents(year, month) {
    const events = await this.getEvents("all", year, month, { publicOnly: true });
    return events.map(toPublicEventDto);
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

    const expectedVersion = Number(data.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      const err = new Error("expectedVersion is required to update an event.");
      err.statusCode = 400;
      err.code = "INVALID_EXPECTED_VERSION";
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

    const nextVisibility = normalizeVisibility(data.visibility, original.visibility);
    const result = await prisma.parishEvent.updateMany({
      where: { id: parsedId, version: expectedVersion },
      data: {
        title: data.title,
        eventType: data.eventType,
        description: data.description !== undefined ? data.description : original.description,
        location: data.location !== undefined ? data.location : original.location,
        eventDate: data.eventDate ? new Date(data.eventDate) : original.eventDate,
        startTime: data.startTime !== undefined ? data.startTime : original.startTime,
        endTime: data.endTime !== undefined ? data.endTime : original.endTime,
        assignedPriestId: data.assignedPriestId !== undefined ? (data.assignedPriestId ? parseInt(data.assignedPriestId, 10) : null) : original.assignedPriestId,
        visibility: nextVisibility,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      const err = new Error("This event changed elsewhere. Reload it before saving your edits.");
      err.statusCode = 409;
      err.code = "EVENT_STALE";
      throw err;
    }
    const event = await prisma.parishEvent.findUnique({
      where: { id: parsedId },
      include: { assignedPriest: { select: { id: true, fullName: true } } },
    });

    await AuditLogService.log(actorId, `Updated parish event #${id}: ${event.title}`, null, false, {
      affectedTable: "ParishEvent",
      affectedRecordId: parsedId,
      parishId: event.parishId,
      previousValues: original,
      newValues: data
    });
    if (original.visibility !== event.visibility) {
      await AuditLogService.log(actorId, "PARISH_EVENT_VISIBILITY_CHANGED", null, false, {
        affectedTable: "ParishEvent",
        affectedRecordId: parsedId,
        parishId: event.parishId,
        previousValues: { visibility: original.visibility },
        newValues: { visibility: event.visibility },
      });
    }

    // Notify newly assigned priest (only when the assignment genuinely changes to a new priest).
    const newPriestId = event.assignedPriestId;
    const oldPriestId = original.assignedPriestId;
    if (newPriestId && newPriestId !== oldPriestId) {
      await NotificationDispatcher._persist(
        [{
          userId: newPriestId,
          title: "New Pastoral Assignment",
          message: `You have been assigned to lead the "${event.title}" event at the parish.`,
          type: "IN_APP",
          referenceType: "GENERAL",
          referenceId: null,
        }],
        prisma
      );
    }

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

  async respondPriestAssignment(id, priestId, status, reason) {
    return PriestAssignmentHandler.handleResponse(id, priestId, status, reason, "EVENT");
  }
}
