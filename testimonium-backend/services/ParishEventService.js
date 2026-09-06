import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { ConflictHelper, parseManilaDateTime } from "./ConflictHelper.js";
import { lockPriestsForScheduling, normalizePriestId } from "./SchedulingAvailability.js";
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

async function validateAssignedEventPriest(tx, priestId, parishId) {
  if (!priestId) return;
  const priest = await tx.user.findUnique({
    where: { id: priestId },
    include: { role: true },
  });
  if (!priest || priest.role?.roleName !== "PRIEST") {
    const error = new Error("Assigned user must be an existing priest.");
    error.statusCode = 400;
    error.code = "INVALID_PRIEST_ROLE";
    throw error;
  }
  if (priest.status !== "ACTIVE") {
    const error = new Error("Assigned priest account is not active.");
    error.statusCode = 400;
    error.code = "PRIEST_INACTIVE";
    throw error;
  }
  if (Number(priest.parishId) !== Number(parishId)) {
    const error = new Error("Assigned priest must belong to the event parish.");
    error.statusCode = 403;
    error.code = "FORBIDDEN_PARISH_ASSIGNMENT";
    throw error;
  }
}

export class ParishEventService {
  async createEvent(parishId, data, actorId) {
    const parsedParishId = parseInt(parishId, 10);
    const parsedPriestId = data.assignedPriestId ? normalizePriestId(data.assignedPriestId) : null;
    const start = parsedPriestId && data.startTime
      ? parseManilaDateTime(data.eventDate, data.startTime)
      : null;
    const end = parsedPriestId && data.startTime && data.endTime
      ? parseManilaDateTime(data.eventDate, data.endTime)
      : null;

    return prisma.$transaction(
      async (tx) => {
        const priestsToLock = [parsedPriestId].filter((pId) => pId !== null && pId !== undefined);
        await lockPriestsForScheduling(tx, priestsToLock);
        await validateAssignedEventPriest(tx, parsedPriestId, parsedParishId);
        if (parsedPriestId) {
          await ConflictHelper.checkPriestConflict(
            parsedPriestId,
            data.eventDate,
            start,
            end,
            { tx, actorId }
          );
        }

        const event = await tx.parishEvent.create({
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
            assignedPriestId: parsedPriestId,
            priestResponseStatus: parsedPriestId ? "PENDING" : null,
            priestResponseReason: null,
            visibility: normalizeVisibility(data.visibility),
            isActive: true,
          },
          include: {
            assignedPriest: { select: { id: true, fullName: true } },
          },
        });

        await AuditLogService.log(actorId, "Parish Event Created", tx, false, {
          affectedTable: "parish_events",
          affectedRecordId: event.id,
          parishId: parsedParishId,
          newValues: {
            title: event.title,
            eventType: event.eventType,
            eventDate: event.eventDate,
            startTime: event.startTime,
            endTime: event.endTime,
            visibility: event.visibility,
            assignedPriestId: event.assignedPriestId,
          },
        });

        if (event.assignedPriestId) {
          await NotificationDispatcher._persist([{
            userId: event.assignedPriestId,
            title: "New Pastoral Assignment",
            message: `You have been assigned to lead the "${event.title}" event at the parish.`,
            type: "IN_APP",
            referenceType: "GENERAL",
            referenceId: null,
          }], tx);
        }

        return event;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
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
    const expectedVersion = Number(data.expectedVersion);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) {
      const err = new Error("expectedVersion is required to update an event.");
      err.statusCode = 400;
      err.code = "INVALID_EXPECTED_VERSION";
      throw err;
    }

    const original = await prisma.parishEvent.findUnique({ where: { id: parsedId } });
    if (!original) {
      const err = new Error("Parish event not found.");
      err.statusCode = 404;
      throw err;
    }

    return prisma.$transaction(
      async (tx) => {
        const requestedPriestId = data.assignedPriestId !== undefined
          ? (data.assignedPriestId ? normalizePriestId(data.assignedPriestId) : null)
          : original.assignedPriestId;
        const priestsToLock = [original.assignedPriestId, requestedPriestId].filter((pId) => pId !== null && pId !== undefined);
        await lockPriestsForScheduling(tx, priestsToLock);

        const current = await tx.parishEvent.findUnique({ where: { id: parsedId } });
        if (!current) {
          const err = new Error("Parish event not found.");
          err.statusCode = 404;
          throw err;
        }
        if (current.version !== expectedVersion) {
          const err = new Error("This event changed elsewhere. Reload it before saving your edits.");
          err.statusCode = 409;
          err.code = "EVENT_STALE";
          throw err;
        }

        const priestId = data.assignedPriestId !== undefined
          ? (data.assignedPriestId ? parseInt(data.assignedPriestId, 10) : null)
          : current.assignedPriestId;
        await validateAssignedEventPriest(tx, priestId, current.parishId);
        const date = data.eventDate || current.eventDate;
        const startTime = data.startTime !== undefined ? data.startTime : current.startTime;
        const endTime = data.endTime !== undefined ? data.endTime : current.endTime;
        const start = priestId && startTime ? parseManilaDateTime(date, startTime) : null;
        const end = priestId && startTime && endTime ? parseManilaDateTime(date, endTime) : null;

        if (priestId) {
          await ConflictHelper.checkPriestConflict(
            priestId,
            date,
            start,
            end,
            { excludeEventId: parsedId, tx, actorId }
          );
        }

        const nextVisibility = normalizeVisibility(data.visibility, current.visibility);
        const result = await tx.parishEvent.updateMany({
          where: { id: parsedId, version: expectedVersion },
          data: {
            title: data.title,
            eventType: data.eventType,
            description: data.description !== undefined ? data.description : current.description,
            location: data.location !== undefined ? data.location : current.location,
            eventDate: data.eventDate ? new Date(data.eventDate) : current.eventDate,
            startTime: data.startTime !== undefined ? data.startTime : current.startTime,
            endTime: data.endTime !== undefined ? data.endTime : current.endTime,
            assignedPriestId: priestId,
            ...(priestId !== current.assignedPriestId
              ? {
                  priestResponseStatus: priestId ? "PENDING" : null,
                  priestResponseReason: null,
                }
              : {}),
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

        const event = await tx.parishEvent.findUnique({
          where: { id: parsedId },
          include: { assignedPriest: { select: { id: true, fullName: true } } },
        });

        await AuditLogService.log(actorId, "Parish Event Updated", tx, false, {
          affectedTable: "parish_events",
          affectedRecordId: parsedId,
          parishId: event.parishId,
          previousValues: {
            title: current.title,
            eventType: current.eventType,
            eventDate: current.eventDate,
            startTime: current.startTime,
            endTime: current.endTime,
            visibility: current.visibility,
            assignedPriestId: current.assignedPriestId,
          },
          newValues: {
            title: event.title,
            eventType: event.eventType,
            eventDate: event.eventDate,
            startTime: event.startTime,
            endTime: event.endTime,
            visibility: event.visibility,
            assignedPriestId: event.assignedPriestId,
          },
        });
        if (current.visibility !== event.visibility) {
          await AuditLogService.log(actorId, "PARISH_EVENT_VISIBILITY_CHANGED", tx, false, {
            affectedTable: "parish_events",
            affectedRecordId: parsedId,
            parishId: event.parishId,
            previousValues: { visibility: current.visibility },
            newValues: { visibility: event.visibility },
          });
        }

        if (event.assignedPriestId && event.assignedPriestId !== current.assignedPriestId) {
          await NotificationDispatcher._persist([{
            userId: event.assignedPriestId,
            title: "New Pastoral Assignment",
            message: `You have been assigned to lead the "${event.title}" event at the parish.`,
            type: "IN_APP",
            referenceType: "GENERAL",
            referenceId: null,
          }], tx);
        }

        return event;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
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

    await AuditLogService.log(actorId, "Parish Event Deleted", null, false, {
      affectedTable: "parish_events",
      affectedRecordId: parsedId,
      parishId: original.parishId,
      previousValues: { isActive: true },
      newValues: { isActive: false },
    });
  }

  async respondPriestAssignment(id, priestId, status, reason) {
    const parsedId = parseInt(id, 10);
    const parsedPriestId = normalizePriestId(priestId);
    if (!Number.isInteger(parsedId)) {
      const error = new Error("Invalid event ID.");
      error.statusCode = 400;
      error.code = "INVALID_ID";
      throw error;
    }

    return prisma.$transaction(
      async (tx) => {
        await lockPriestsForScheduling(tx, [parsedPriestId]);
        const current = await tx.parishEvent.findUnique({
          where: { id: parsedId },
          include: {
            parish: { select: { id: true, parishName: true } },
            assignedPriest: { select: { id: true, fullName: true } },
          },
        });
        if (!current) {
          const error = new Error("Parish event not found.");
          error.statusCode = 404;
          throw error;
        }
        if (current.assignedPriestId !== parsedPriestId) {
          const error = new Error("You are not the priest assigned to this event.");
          error.statusCode = 403;
          throw error;
        }
        if (status === "ACCEPTED" && current.priestResponseStatus === "ACCEPTED") {
          return current;
        }

        if (status === "ACCEPTED" && current.startTime) {
          const start = parseManilaDateTime(current.eventDate, current.startTime);
          const end = current.endTime
            ? parseManilaDateTime(current.eventDate, current.endTime)
            : null;
          await ConflictHelper.checkPriestConflict(
            parsedPriestId,
            current.eventDate,
            start,
            end,
            {
              excludeEventId: current.id,
              tx,
              actorId: parsedPriestId,
              isPriestOwner: true,
            }
          );
        }

        const updated = await tx.parishEvent.update({
          where: { id: parsedId },
          data: {
            assignedPriestId: status === "REJECTED" ? null : current.assignedPriestId,
            priestResponseStatus: status,
            priestResponseReason: reason || null,
            version: { increment: 1 },
          },
          include: {
            parish: { select: { id: true, parishName: true } },
            assignedPriest: { select: { id: true, fullName: true } },
          },
        });

        await NotificationDispatcher.notifyPriestResponse({
          parishId: updated.parishId,
          scheduleId: updated.id + 100000,
          displayTitle: updated.title,
          priestName: current.assignedPriest?.fullName || "Priest",
          status,
          reason,
          referenceType: "SCHEDULE_REQUEST",
        }, tx);

        await AuditLogService.log(
          parsedPriestId,
          "Priest Assignment Response Updated",
          tx,
          false,
          {
            affectedTable: "parish_events",
            affectedRecordId: parsedId,
            parishId: updated.parishId,
            previousValues: {
              assignedPriestId: current.assignedPriestId,
              priestResponseStatus: current.priestResponseStatus,
            },
            newValues: {
              assignedPriestId: updated.assignedPriestId,
              priestResponseStatus: updated.priestResponseStatus,
            },
          }
        );

        return updated;
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }
}
