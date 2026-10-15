import { getMassOccurrences, setMassOccurrenceLayMinister } from "./MassOccurrenceService.js";
import { prisma } from "../config/db.js";
import { AuditLogService } from "./AuditLogService.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import {
  ConflictHelper,
  BLOCKING_SCHEDULE_STATUSES,
  getManilaDateString,
  massTemplateAppliesOnDate,
  parseManilaDateTime,
} from "./ConflictHelper.js";
import { lockParishSchedulingConfiguration, lockPriestsForScheduling, normalizePriestId } from "./SchedulingAvailability.js";
import {
  classifyPriestAvailability,
  PriestAvailabilityClassification,
} from "./ScheduleAvailabilityDomainService.js";
import {
  decorateMassTemplateForDisplay,
  resolveMassDisplayLabel,
} from "../shared/LayMinisterPresentation.js";

const MASS_CONFLICT_DURATION_MS = 60 * 60 * 1000;
const LAY_MINISTER_RECURRING_WINDOW_DAYS = 7;

function addCandidateDates(set, startInput, endInput = startInput) {
  const start = new Date(startInput);
  const end = new Date(endInput);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return;
  const today = new Date(`${getManilaDateString(new Date())}T00:00:00.000+08:00`);
  let cursor = new Date(Math.max(start.getTime(), today.getTime()));
  const last = new Date(Math.max(cursor.getTime(), end.getTime()));
  for (let count = 0; count < 14 && cursor <= last; count += 1) {
    set.add(getManilaDateString(cursor));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
}

async function validateAssignedPriest(tx, priestId, parishId) {
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
    const error = new Error("Assigned priest must belong to the Mass schedule parish.");
    error.statusCode = 403;
    error.code = "FORBIDDEN_PARISH_ASSIGNMENT";
    throw error;
  }
}

async function validateRecurringMassConflicts(
  tx,
  priestId,
  dayType,
  timeSlot,
  excludeMassTemplateId,
  actorId
) {
  if (!priestId) return;
  const today = new Date(`${getManilaDateString(new Date())}T00:00:00.000Z`);
  const [schedules, events, personalSchedules, leaves] = await Promise.all([
    tx.schedule.findMany({
      where: {
        assignedPriestId: priestId,
        status: { in: BLOCKING_SCHEDULE_STATUSES },
        requestedDate: { gte: today },
      },
      select: { requestedDate: true },
    }),
    tx.parishEvent.findMany({
      where: {
        assignedPriestId: priestId,
        isActive: true,
        eventDate: { gte: today },
      },
      select: { eventDate: true },
    }),
    tx.priestPersonalSchedule.findMany({
      where: { priestId, endAt: { gt: new Date() } },
      select: { startAt: true, endAt: true },
    }),
    tx.parishAvailability.findMany({
      where: { userId: priestId, type: "PRIEST_LEAVE", endDate: { gte: today } },
      select: { startDate: true, endDate: true },
    }),
  ]);

  const candidateDates = new Set();
  for (const schedule of schedules) addCandidateDates(candidateDates, schedule.requestedDate);
  for (const event of events) addCandidateDates(candidateDates, event.eventDate);
  for (const personal of personalSchedules) addCandidateDates(candidateDates, personal.startAt, personal.endAt);
  for (const leave of leaves) addCandidateDates(candidateDates, leave.startDate, leave.endDate);
  addCandidateDates(candidateDates, new Date(), new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));

  for (const dateStr of [...candidateDates].sort()) {
    if (!massTemplateAppliesOnDate(dayType, dateStr)) continue;
    const start = parseManilaDateTime(dateStr, timeSlot);
    if (!start) {
      const error = new Error("Invalid Mass time slot.");
      error.statusCode = 400;
      error.code = "INVALID_MASS_TIME_SLOT";
      throw error;
    }
    await ConflictHelper.checkPriestConflict(
      priestId,
      dateStr,
      start,
      new Date(start.getTime() + MASS_CONFLICT_DURATION_MS),
      { excludeMassTemplateId, tx, actorId }
    );
  }
}

async function validateRecurringLayMinisterEligibility(
  tx,
  priests,
  dayType,
  timeSlot,
  excludeMassTemplateId,
  actorId
) {
  if (!priests.length) return;
  const todayStr = getManilaDateString(new Date());
  let occurrenceCount = 0;
  for (let offset = 0; offset < LAY_MINISTER_RECURRING_WINDOW_DAYS; offset += 1) {
    const date = new Date(`${todayStr}T00:00:00.000+08:00`);
    date.setUTCDate(date.getUTCDate() + offset);
    const dateStr = getManilaDateString(date);
    if (!massTemplateAppliesOnDate(dayType, dateStr)) continue;
    occurrenceCount += 1;
    const start = parseManilaDateTime(dateStr, timeSlot);
    if (!start) {
      const error = new Error("Invalid Mass time slot.");
      error.statusCode = 400;
      error.code = "INVALID_MASS_TIME_SLOT";
      throw error;
    }
    const end = new Date(start.getTime() + MASS_CONFLICT_DURATION_MS);
    for (const priest of priests) {
      const classification = await classifyPriestAvailability({
        priestId: priest.id,
        date: dateStr,
        startDatetime: start,
        endDatetime: end,
        excludeMassTemplateId,
        timeSlot,
        actorId,
        actorRole: "SECRETARY",
        tx,
      });
      if (classification === PriestAvailabilityClassification.AVAILABLE) {
        const error = new Error("A parish priest is available for at least one occurrence in the 7-day verification window.");
        error.statusCode = 409;
        error.code = "LAY_MINISTER_PRIEST_AVAILABLE";
        throw error;
      }
      if (classification === PriestAvailabilityClassification.UNKNOWN) {
        const error = new Error("Priest availability could not be verified for every occurrence in the 7-day verification window.");
        error.statusCode = 409;
        error.code = "LAY_MINISTER_AVAILABILITY_UNVERIFIED";
        throw error;
      }
    }
  }
  if (occurrenceCount === 0) {
    const error = new Error("No applicable recurring Mass occurrence could be verified in the bounded window.");
    error.statusCode = 422;
    error.code = "MASS_RECURRENCE_UNVERIFIED";
    throw error;
  }
}


export class MassScheduleService {
  getOccurrences(parishId, from) { return getMassOccurrences(parishId, from); }

  setOccurrenceLayMinister(parishId, templateId, date, input, actorId, assign) {
    return setMassOccurrenceLayMinister(parishId, templateId, date, input, actorId, assign);
  }

  /**
   * Retrieves active Mass schedule templates for a parish.
   */
  async getTemplates(parishId) {
    const parsedId = parseInt(parishId, 10);
    
    // Auto-seed if templates are completely empty
    const count = await prisma.massScheduleTemplate.count({
      where: { parishId: parsedId, isActive: true }
    });
    
    if (count === 0) {
      await this.seedDefaults(parsedId);
    }

    const templates = await prisma.massScheduleTemplate.findMany({
      where: { parishId: parsedId, isActive: true },
      include: {
        assignedPriest: { select: { id: true, fullName: true, isAssistant: true } }
      },
      orderBy: [
        { dayType: "asc" },
        { timeSlot: "asc" }
      ]
    });
    return templates.map(decorateMassTemplateForDisplay);
  }

  /**
   * Creates or updates a Mass schedule template.
   */
  async upsertTemplate(parishId, {
    id,
    dayType,
    timeSlot,
    label,
    assignedPriestId,
    layMinisterAssigned,
    assignedPriestIdPresent = false,
    layMinisterAssignedPresent = false,
    expectedUpdatedAt = null,
    actorId,
  }) {
    const parsedParishId = parseInt(parishId, 10);
    const parsedId = id ? parseInt(id, 10) : null;

    return prisma.$transaction(
      async (tx) => {
        await lockParishSchedulingConfiguration(tx, parsedParishId);
        const original = parsedId
          ? await tx.massScheduleTemplate.findUnique({ where: { id: parsedId } })
          : null;
        if (parsedId && (!original || original.parishId !== parsedParishId)) {
          const error = new Error("Mass schedule template not found in this parish.");
          error.statusCode = 404;
          throw error;
        }

        let parsedPriestId = original?.assignedPriestId ?? null;
        let targetLayMinister = original?.layMinisterAssigned ?? false;
        if (!original) {
          parsedPriestId = assignedPriestIdPresent && assignedPriestId
            ? normalizePriestId(assignedPriestId)
            : null;
          targetLayMinister = layMinisterAssignedPresent && layMinisterAssigned === true;
        } else {
          if (layMinisterAssignedPresent && layMinisterAssigned === true) {
            if (assignedPriestIdPresent && assignedPriestId) {
              const error = new Error("Lay Minister and priest assignments cannot be selected together.");
              error.statusCode = 400;
              error.code = "INVALID_ASSIGNMENT";
              throw error;
            }
            targetLayMinister = true;
            parsedPriestId = null;
          } else if (assignedPriestIdPresent) {
            parsedPriestId = assignedPriestId ? normalizePriestId(assignedPriestId) : null;
            targetLayMinister = false;
          } else if (layMinisterAssignedPresent && layMinisterAssigned === false) {
            targetLayMinister = false;
          }
        }
        if (targetLayMinister && parsedPriestId) {
          const error = new Error("Lay Minister and priest assignments cannot be selected together.");
          error.statusCode = 400;
          error.code = "INVALID_ASSIGNMENT";
          throw error;
        }

        const assignmentChanged = Boolean(original) && (
          original.assignedPriestId !== parsedPriestId
          || Boolean(original.layMinisterAssigned) !== targetLayMinister
        );
        if (assignmentChanged && !expectedUpdatedAt) {
          const error = new Error("Refresh the Mass schedule before changing its assignment.");
          error.statusCode = 409;
          error.code = "MASS_ASSIGNMENT_CONCURRENCY_CONFLICT";
          throw error;
        }
        if (assignmentChanged && expectedUpdatedAt) {
          const expected = new Date(expectedUpdatedAt);
          if (Number.isNaN(expected.getTime()) || expected.getTime() !== original.updatedAt.getTime()) {
            const error = new Error("Mass schedule assignment changed in another editor. Please refresh and retry.");
            error.statusCode = 409;
            error.code = "MASS_ASSIGNMENT_CONCURRENCY_CONFLICT";
            throw error;
          }
        }

        const eligiblePriests = targetLayMinister
          ? await tx.user.findMany({
              where: {
                parishId: parsedParishId,
                role: { roleName: "PRIEST" },
                status: "ACTIVE",
              },
              select: { id: true },
              orderBy: { id: "asc" },
            })
          : [];
        const priestsToLock = [
          original?.assignedPriestId,
          parsedPriestId,
          ...eligiblePriests.map((priest) => priest.id),
        ].filter((pId) => pId !== null && pId !== undefined);
        await lockPriestsForScheduling(tx, priestsToLock);
        await validateAssignedPriest(tx, parsedPriestId, parsedParishId);
        await validateRecurringMassConflicts(
          tx,
          parsedPriestId,
          dayType,
          timeSlot,
          parsedId,
          actorId
        );
        if (targetLayMinister) {
          await validateRecurringLayMinisterEligibility(
            tx,
            eligiblePriests,
            dayType,
            timeSlot,
            parsedId,
            actorId
          );
        }

        const priestChanged = original?.assignedPriestId !== parsedPriestId;
        const data = {
          dayType,
          timeSlot,
          label,
          ...(original && (original.dayType !== dayType || original.timeSlot !== timeSlot || assignmentChanged)
            ? { occurrenceRevision: { increment: 1 } } : {}),
          assignedPriestId: parsedPriestId,
          layMinisterAssigned: targetLayMinister,
          ...(priestChanged || Boolean(original?.layMinisterAssigned) !== targetLayMinister
            ? {
                priestResponseStatus: parsedPriestId && !targetLayMinister ? "PENDING" : null,
                priestResponseReason: null,
              }
            : {}),
        };

        const template = original
          ? await tx.massScheduleTemplate.update({
              where: { id: parsedId },
              data,
              include: {
                assignedPriest: { select: { id: true, fullName: true, isAssistant: true } },
              },
            })
          : await tx.massScheduleTemplate.create({
              data: {
                parishId: parsedParishId,
                ...data,
                priestResponseStatus: parsedPriestId && !targetLayMinister ? "PENDING" : null,
                isActive: true,
              },
              include: {
                assignedPriest: { select: { id: true, fullName: true, isAssistant: true } },
              },
            });

        await AuditLogService.log(
          actorId,
          original ? "Mass Schedule Template Updated" : "Mass Schedule Template Created",
          tx,
          false,
          {
            affectedTable: "mass_schedule_templates",
            affectedRecordId: template.id,
            parishId: parsedParishId,
            previousValues: original ? {
              dayType: original.dayType,
              timeSlot: original.timeSlot,
              label: original.label,
              assignedPriestId: original.assignedPriestId,
              layMinisterAssigned: original.layMinisterAssigned,
            } : undefined,
            newValues: {
              dayType,
              timeSlot,
              label,
              assignedPriestId: parsedPriestId,
              layMinisterAssigned: targetLayMinister,
              recurringAvailabilityWindowDays: targetLayMinister ? LAY_MINISTER_RECURRING_WINDOW_DAYS : undefined,
            },
          }
        );

        if (parsedPriestId && !targetLayMinister && (!original || priestChanged)) {
          await NotificationDispatcher.notifyPriestAssigned({
            parishionerId: null,
            parishId: parsedParishId,
            scheduleId: template.id + 200000,
            displayTitle: `${label || "Holy Mass"} (${dayType} at ${timeSlot})`,
            priestId: parsedPriestId,
            priestName: template.assignedPriest?.fullName || "Priest",
          }, tx);
        }

        return decorateMassTemplateForDisplay(template);
      },
      {
        isolationLevel: "Serializable",
        maxWait: 5000,
        timeout: 15000,
      }
    );
  }

  /**
   * Soft deletes a template.
   */
  async deleteTemplate(id, actorId) {
    const parsedId = parseInt(id, 10);
    const template = await prisma.massScheduleTemplate.findUnique({
      where: { id: parsedId }
    });

    if (!template) {
      const err = new Error("Template not found.");
      err.statusCode = 404;
      throw err;
    }

    await prisma.massScheduleTemplate.update({
      where: { id: parsedId },
      data: { isActive: false }
    });

    await AuditLogService.log(actorId, "Mass Schedule Template Deleted", null, false, {
      affectedTable: "mass_schedule_templates",
      affectedRecordId: parsedId,
      parishId: template.parishId,
      previousValues: { isActive: true },
      newValues: { isActive: false },
    });
  }

  /**
   * Resets default Mass templates.
   */
  async resetDefaults(parishId, actorId) {
    const parsedId = parseInt(parishId, 10);
    
    await prisma.massScheduleTemplate.updateMany({
      where: { parishId: parsedId, isActive: true },
      data: { isActive: false }
    });

    await this.seedDefaults(parsedId);

    await AuditLogService.log(actorId, "Mass Schedule Defaults Restored", null, false, {
      affectedTable: "mass_schedule_templates",
      parishId: parsedId,
    });
  }

  /**
   * Seeds default Mass slots for a parish.
   */
  async seedDefaults(parishId) {
    const parsedId = parseInt(parishId, 10);
    const defaults = [
      // Weekdays (Wednesday and Friday)
      { dayType: "WEDNESDAY", timeSlot: "06:00 AM", label: "Morning Mass" },
      { dayType: "WEDNESDAY", timeSlot: "05:15 PM", label: "Evening Mass" },
      { dayType: "FRIDAY", timeSlot: "06:00 AM", label: "Morning Mass" },
      { dayType: "FRIDAY", timeSlot: "05:15 PM", label: "Evening Mass" },
      // Sundays
      { dayType: "SUNDAY", timeSlot: "05:00 AM", label: "Sunday Early Mass" },
      { dayType: "SUNDAY", timeSlot: "07:00 AM", label: "Sunday Morning Mass" },
      { dayType: "SUNDAY", timeSlot: "09:00 AM", label: "Sunday High Mass" },
      { dayType: "SUNDAY", timeSlot: "04:00 PM", label: "Sunday Afternoon Mass" },
      { dayType: "SUNDAY", timeSlot: "06:00 PM", label: "Sunday Evening Mass" },
    ];

    await prisma.$transaction(
      defaults.map((d) =>
        prisma.massScheduleTemplate.create({
          data: {
            parishId: parsedId,
            dayType: d.dayType,
            timeSlot: d.timeSlot,
            label: d.label,
            isActive: true,
          },
        })
      )
    );
  }

  async respondPriestAssignment(id, priestId, status, reason) {
    const parsedId = parseInt(id, 10);
    const parsedPriestId = normalizePriestId(priestId);
    if (!Number.isInteger(parsedId)) {
      const error = new Error("Invalid Mass template ID.");
      error.statusCode = 400;
      error.code = "INVALID_ID";
      throw error;
    }

    return prisma.$transaction(
      async (tx) => {
        await lockPriestsForScheduling(tx, [parsedPriestId]);
        const current = await tx.massScheduleTemplate.findUnique({
          where: { id: parsedId },
          include: {
            parish: { select: { id: true, parishName: true } },
            assignedPriest: { select: { id: true, fullName: true } },
          },
        });
        if (!current) {
          const error = new Error("Mass schedule template not found.");
          error.statusCode = 404;
          throw error;
        }
        if (current.assignedPriestId !== parsedPriestId) {
          const error = new Error("You are not the priest assigned to this Mass schedule.");
          error.statusCode = 403;
          throw error;
        }
        if (status === "ACCEPTED" && current.priestResponseStatus === "ACCEPTED") {
          return current;
        }

        if (status === "ACCEPTED") {
          await validateRecurringMassConflicts(
            tx,
            parsedPriestId,
            current.dayType,
            current.timeSlot,
            current.id,
            parsedPriestId
          );
        }

        const updated = await tx.massScheduleTemplate.update({
          where: { id: parsedId },
          data: status === "REJECTED"
            ? {
                assignedPriestId: null,
                priestResponseStatus: "REJECTED",
                priestResponseReason: reason || null,
              }
            : {
                priestResponseStatus: "ACCEPTED",
                priestResponseReason: reason || null,
              },
          include: {
            parish: { select: { id: true, parishName: true } },
            assignedPriest: { select: { id: true, fullName: true } },
          },
        });

        await NotificationDispatcher.notifyPriestResponse({
          parishId: updated.parishId,
          scheduleId: updated.id + 200000,
          displayTitle: (updated.label || "Holy Mass") + " (" + updated.dayType + " at " + updated.timeSlot + ")",
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
            affectedTable: "mass_schedule_templates",
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
