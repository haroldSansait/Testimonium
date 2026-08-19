import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { prisma } from "../config/db.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";
import { ConflictHelper, parseManilaDateTime } from "./ConflictHelper.js";
import { NotificationDispatcher } from "./NotificationDispatcher.js";
import { PriestAssignmentHandler } from "./PriestAssignmentHandler.js";

export class ScheduleService {
  constructor(scheduleRepository = new ScheduleRepository()) {
    this.scheduleRepository = scheduleRepository;
  }

  /**
   * Returns a paginated list of schedule requests with optional filters.
   * @param {object} opts
   * @param {number} opts.page
   * @param {number} opts.limit
   * @param {string|undefined} opts.search
   * @param {string|undefined} opts.status
   */
  async list({ page = 1, limit = 10, search, status, parishId, userId, priestId } = {}) {
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    // Custom filtering for parishioner context
    const skip = (parsedPage - 1) * parsedLimit;
    const where = {};

    if (userId) {
      where.userId = parseInt(userId, 10);
    }

    if (parishId) {
      where.parishId = parseInt(parishId, 10);
    }

    if (priestId) {
      where.assignedPriestId = parseInt(priestId, 10);
      if (status === "PENDING") {
        where.priestResponseStatus = null;
      }
    }

    if (status && !priestId) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { user: { fullName: { contains: search, mode: "insensitive" } } },
        { remarks: { contains: search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.schedule.findMany({
        where,
        include: {
          user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
          parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
          processedBy: { select: { id: true, fullName: true } },
          assignedPriest: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parsedLimit,
      }),
      prisma.schedule.count({ where }),
    ]);

    // If priestId is provided, also fetch ParishEvent assignments for this priest and merge them
    if (priestId) {
      const parsedPriestId = parseInt(priestId, 10);
      
      const eventWhere = {
        assignedPriestId: parsedPriestId,
        isActive: true,
      };

      // Filter by priestResponseStatus if filtering by status
      if (status === "PENDING") {
        eventWhere.priestResponseStatus = null;
      }

      const parishEvents = await prisma.parishEvent.findMany({
        where: eventWhere,
        include: {
          parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
          assignedPriest: { select: { id: true, fullName: true } },
          createdBy: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      // Map ParishEvent to Schedule DTO shape
      const mappedEvents = parishEvents.map(e => {
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

        const start = e.startTime ? combine(e.eventDate, e.startTime) : null;
        const end = e.endTime ? combine(e.eventDate, e.endTime) : null;

        return {
          id: e.id + 100000, // Safe offset key to distinguish ParishEvent from Schedule
          isParishEvent: true, // flag
          userId: e.createdById || 0,
          parishId: e.parishId,
          eventType: e.eventType,
          displayTitle: e.title,
          requestedDate: e.eventDate,
          startDatetime: start,
          endDatetime: end,
          status: "CONFIRMED",
          remarks: e.description || "",
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
          user: {
            id: e.createdById || 0,
            fullName: e.createdBy?.fullName || "Staff",
            email: e.createdBy?.email || "staff@diocese.org",
            contactNumber: "",
          },
          parish: e.parish,
          assignedPriest: e.assignedPriest,
          priestResponseStatus: e.priestResponseStatus,
          priestResponseReason: e.priestResponseReason,
        };
      });

      // Fetch MassScheduleTemplate assignments for this priest and merge them
      const templateWhere = {
        assignedPriestId: parsedPriestId,
        isActive: true,
      };

      if (status === "PENDING") {
        templateWhere.priestResponseStatus = { notIn: ["ACCEPTED", "REJECTED"] };
      }

      const massTemplates = await prisma.massScheduleTemplate.findMany({
        where: templateWhere,
        include: {
          parish: { select: { id: true, parishName: true, type: true, municipalityCity: true } },
          assignedPriest: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const mappedTemplates = massTemplates.map(t => {
        const getNextDayOfWeek = (dayName) => {
          const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
          const targetDay = days.indexOf(dayName);
          if (targetDay === -1) return new Date();
          const resultDate = new Date();
          resultDate.setDate(resultDate.getDate() + (targetDay + 7 - resultDate.getDay()) % 7);
          return resultDate;
        };
        const nextOccur = getNextDayOfWeek(t.dayType);

        return {
          id: t.id + 200000, // Safe offset key to distinguish MassScheduleTemplate
          isMassTemplate: true,
          userId: 0,
          parishId: t.parishId,
          eventType: "PRIVATE_MASS",
          displayTitle: `${t.label || "Holy Mass"} (${t.dayType})`,
          requestedDate: nextOccur,
          startDatetime: null,
          endDatetime: null,
          status: "CONFIRMED",
          remarks: `Time Slot: ${t.timeSlot}. Recurring Mass schedule on ${t.dayType}.`,
          createdAt: t.createdAt,
          updatedAt: t.updatedAt,
          user: {
            id: 0,
            fullName: "Parish Staff",
            email: "staff@diocese.org",
            contactNumber: "",
          },
          parish: t.parish,
          assignedPriest: t.assignedPriest,
          priestResponseStatus: t.priestResponseStatus,
          priestResponseReason: t.priestResponseReason,
        };
      });

      // Combine, sort by createdAt desc, and paginate
      const combined = [...data, ...mappedEvents, ...mappedTemplates];
      combined.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const paginated = combined.slice(skip, skip + parsedLimit);
      return {
        data: paginated,
        total: total + mappedEvents.length + mappedTemplates.length,
      };
    }

    return { data, total };
  }

  /**
   * Book a new schedule slot with concurrency locking and multi-layer validation.
   */
  async create({ userId, parishId, eventType, displayTitle, requestedDate, timeSlot, remarks = "" }) {
    const parsedParishId = parseInt(parishId, 10);
    if (isNaN(parsedParishId)) {
      const err = new Error("Invalid parish ID provided.");
      err.statusCode = 400;
      throw err;
    }

    const targetDate = new Date(requestedDate);
    if (isNaN(targetDate.getTime())) {
      const err = new Error("Invalid requested date.");
      err.statusCode = 400;
      throw err;
    }
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate.getTime() < today.getTime()) {
      const err = new Error("Cannot schedule appointments or sacraments for past dates.");
      err.statusCode = 400;
      throw err;
    }

    // 1. Fetch Parish Configuration
    const parish = await prisma.parish.findUnique({
      where: { id: parsedParishId },
    });
    if (!parish) {
      const err = new Error("Parish not found.");
      err.statusCode = 404;
      throw err;
    }

    // 2. Validate Office Hours / Closed Days
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDayName = dayNames[targetDate.getDay()];
    if (parish.officeHours) {
      try {
        const officeConfig = typeof parish.officeHours === "string" ? JSON.parse(parish.officeHours) : parish.officeHours;
        const daySchedule = officeConfig[targetDayName];
        if (daySchedule && (daySchedule.isClosed || daySchedule.closed)) {
          const formattedDay = targetDayName.charAt(0).toUpperCase() + targetDayName.slice(1);
          const err = new Error(`The parish office is closed on ${formattedDay}s. Please choose an open day.`);
          err.statusCode = 400;
          throw err;
        }
      } catch (e) {
        if (e.statusCode) throw e;
        logger.warn({ err: e }, "[ScheduleService] Error parsing parish officeHours");
      }
    }

    // 3. Parse Event Settings (Available Sacraments, Capacity, Configured Time Slots)
    let eventSettings = null;
    if (parish.eventSettings) {
      try {
        eventSettings = typeof parish.eventSettings === "string" ? JSON.parse(parish.eventSettings) : parish.eventSettings;
      } catch (e) {
        logger.warn({ err: e }, "[ScheduleService] Error parsing parish eventSettings");
      }
    }

    // Validate if sacrament is offered
    if (eventSettings && Array.isArray(eventSettings.availableEvents) && eventSettings.availableEvents.length > 0) {
      const normalizedReqEvent = String(eventType).toUpperCase().replace(/[\s-]/g, "_");
      const isOffered = eventSettings.availableEvents.some((ev) => {
        const norm = String(ev).toUpperCase().replace(/[\s-]/g, "_");
        return norm === normalizedReqEvent || norm.includes(normalizedReqEvent) || normalizedReqEvent.includes(norm);
      });

      if (!isOffered) {
        const err = new Error(`The sacrament/event "${eventType}" is not currently offered for online scheduling by ${parish.parishName}.`);
        err.statusCode = 400;
        throw err;
      }
    }

    // 4. Validate Allowable Time Slots
    const isSaturday = targetDate.getDay() === 6;
    const defaultSlots = isSaturday
      ? ["06:00 AM", "08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"]
      : ["08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"];

    let allowableSlots = defaultSlots;
    if (eventSettings) {
      if (eventType && eventSettings.eventTimeSlots && eventSettings.eventTimeSlots[eventType] && Array.isArray(eventSettings.eventTimeSlots[eventType])) {
        allowableSlots = eventSettings.eventTimeSlots[eventType];
      } else if (Array.isArray(eventSettings.timeSlots)) {
        allowableSlots = eventSettings.timeSlots;
      }
    }

    if (timeSlot && !allowableSlots.includes(timeSlot)) {
      const err = new Error(`Selected time slot "${timeSlot}" is not valid for ${parish.parishName}. Available slots: ${allowableSlots.join(", ")}`);
      err.statusCode = 400;
      throw err;
    }

    // 5. Capacity Boundaries
    const slotCapacity = eventSettings?.capacitySettings?.slotCapacity ? parseInt(eventSettings.capacitySettings.slotCapacity, 10) : 1;
    const dailyLimit = eventSettings?.capacitySettings?.dailyLimit ? parseInt(eventSettings.capacitySettings.dailyLimit, 10) : 10;

    // 6. Atomic Concurrency Lock inside Prisma Transaction
    const startDatetime = timeSlot ? parseManilaDateTime(targetDate, timeSlot) : null;
    const endDatetime = startDatetime ? new Date(startDatetime.getTime() + 60 * 60 * 1000) : null;
    const finalRemarks = timeSlot ? `Time Slot: ${timeSlot}. ${remarks}`.trim() : remarks.trim();

    const createdSchedule = await prisma.$transaction(async (tx) => {
      // Check block entries inside transaction
      const block = await tx.parishAvailability.findFirst({
        where: {
          parishId: parsedParishId,
          startDate: { lte: targetDate },
          endDate: { gte: targetDate },
          type: { in: ["PARISH_CLOSED", "SECRETARY_LEAVE", "FULLY_BOOKED"] }
        }
      });

      if (block) {
        const err = new Error(`Parish is unavailable on this date: ${block.title} (${block.type}).`);
        err.statusCode = 400;
        throw err;
      }

      // Query active bookings for the day
      const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
      const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

      const activeBookings = await tx.schedule.findMany({
        where: {
          parishId: parsedParishId,
          requestedDate: {
            gte: dayStart,
            lte: dayEnd,
          },
          status: { in: ["PENDING", "CONFIRMED", "REQUESTED", "PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE"] },
        },
        select: { id: true, startDatetime: true, endDatetime: true, remarks: true },
      });

      // Daily Limit Check
      if (activeBookings.length >= dailyLimit) {
        const err = new Error(`Daily capacity reached for ${parish.parishName} on ${targetDate.toLocaleDateString()}. Maximum of ${dailyLimit} appointments allowed per day.`);
        err.statusCode = 409;
        throw err;
      }

      // Structured Slot Capacity Check (Using exact startDatetime/endDatetime intervals)
      if (startDatetime && endDatetime) {
        const matchingSlotBookings = activeBookings.filter((b) => {
          if (b.startDatetime && b.endDatetime) {
            return new Date(b.startDatetime) < endDatetime && new Date(b.endDatetime) > startDatetime;
          }
          return b.remarks && b.remarks.startsWith(`Time Slot: ${timeSlot}`);
        });

        if (matchingSlotBookings.length >= slotCapacity) {
          const err = new Error(`Capacity full for time slot "${timeSlot}". Please select a different time slot or date.`);
          err.statusCode = 409;
          throw err;
        }
      }

      // Create booking record
      return tx.schedule.create({
        data: {
          userId: parseInt(userId, 10),
          parishId: parsedParishId,
          eventType,
          displayTitle: displayTitle || `${eventType} Booking`,
          requestedDate: targetDate,
          startDatetime,
          endDatetime,
          remarks: finalRemarks,
          status: "PENDING",
        },
        include: {
          parish: { select: { id: true, parishName: true } },
        },
      });
    }, {
      isolationLevel: 'Serializable',
      maxWait: 5000,
      timeout: 10000,
    });

    // Notify parishioner + admins of new booking
    try {
      await RequestNotificationService.notifyScheduleChange(
        parseInt(userId, 10),
        createdSchedule.parishId,
        createdSchedule.id,
        createdSchedule.displayTitle || eventType,
        "PENDING",
        null,
        true
      );
    } catch (notifErr) {
      logger.warn({ err: notifErr }, "[ScheduleService] Failed to dispatch schedule notification");
    }

    // Audit log
    await AuditLogService.log(userId, `Booked a new schedule request: ${displayTitle || eventType}`, null, false, {
      affectedTable: "Schedule",
      affectedRecordId: createdSchedule.id,
      parishId: createdSchedule.parishId,
      newValues: { eventType, displayTitle, requestedDate, timeSlot, remarks }
    });

    return createdSchedule;
  }

  /**
   * Calculates available slots for a parish on a given date by subtracting booked slots and evaluating capacity.
   */
  async getAvailableSlots(parishId, date, eventType) {
    const parsedParishId = parseInt(parishId, 10);
    const targetDate = new Date(date);
    if (isNaN(targetDate.getTime())) return [];
    targetDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (targetDate.getTime() < today.getTime()) {
      return [];
    }

    // 1. Fetch Parish
    const parish = await prisma.parish.findUnique({
      where: { id: parsedParishId },
    });
    if (!parish) return [];

    // 2. Check Office Hours
    const dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const targetDayName = dayNames[targetDate.getDay()];
    if (parish.officeHours) {
      try {
        const officeConfig = typeof parish.officeHours === "string" ? JSON.parse(parish.officeHours) : parish.officeHours;
        const daySchedule = officeConfig[targetDayName];
        if (daySchedule && (daySchedule.isClosed || daySchedule.closed)) {
          return [];
        }
      } catch (e) {
        logger.warn({ err: e }, "[ScheduleService] Error parsing parish officeHours in getAvailableSlots");
      }
    }

    // 3. Check parish availability block
    const block = await prisma.parishAvailability.findFirst({
      where: {
        parishId: parsedParishId,
        startDate: { lte: targetDate },
        endDate: { gte: targetDate },
        type: { in: ["PARISH_CLOSED", "SECRETARY_LEAVE", "FULLY_BOOKED"] }
      }
    });

    if (block) {
      return [];
    }

    // 4. Parse Event Settings
    let eventSettings = null;
    if (parish.eventSettings) {
      try {
        eventSettings = typeof parish.eventSettings === "string" ? JSON.parse(parish.eventSettings) : parish.eventSettings;
      } catch (e) {
        logger.warn({ err: e }, "[ScheduleService] Error parsing eventSettings in getAvailableSlots");
      }
    }

    // Check if sacrament is offered
    if (eventType && eventSettings && Array.isArray(eventSettings.availableEvents) && eventSettings.availableEvents.length > 0) {
      const normalizedReqEvent = String(eventType).toUpperCase().replace(/[\s-]/g, "_");
      const isOffered = eventSettings.availableEvents.some((ev) => {
        const norm = String(ev).toUpperCase().replace(/[\s-]/g, "_");
        return norm === normalizedReqEvent || norm.includes(normalizedReqEvent) || normalizedReqEvent.includes(norm);
      });
      if (!isOffered) return [];
    }

    // Determine configured time slots
    const isSaturday = targetDate.getDay() === 6;
    const defaultSlots = isSaturday
      ? ["06:00 AM", "08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"]
      : ["08:00 AM", "09:30 AM", "01:30 PM", "03:30 PM"];

    let candidateSlots = defaultSlots;
    if (eventSettings) {
      if (eventType && eventSettings.eventTimeSlots && eventSettings.eventTimeSlots[eventType] && Array.isArray(eventSettings.eventTimeSlots[eventType])) {
        candidateSlots = eventSettings.eventTimeSlots[eventType];
      } else if (Array.isArray(eventSettings.timeSlots)) {
        candidateSlots = eventSettings.timeSlots;
      }
    }

    const slotCapacity = eventSettings?.capacitySettings?.slotCapacity ? parseInt(eventSettings.capacitySettings.slotCapacity, 10) : 1;
    const dailyLimit = eventSettings?.capacitySettings?.dailyLimit ? parseInt(eventSettings.capacitySettings.dailyLimit, 10) : 10;

    // Fetch existing bookings for that day
    const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const dayEnd = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);

    const bookings = await prisma.schedule.findMany({
      where: {
        parishId: parsedParishId,
        requestedDate: {
          gte: dayStart,
          lte: dayEnd,
        },
        status: { in: ["PENDING", "CONFIRMED", "REQUESTED", "PROPOSED_RESCHEDULE", "WAITING_PARISHIONER_RESPONSE"] },
      },
      select: { startDatetime: true, endDatetime: true, remarks: true },
    });

    if (bookings.length >= dailyLimit) {
      return [];
    }

    // Filter candidate slots by checking capacity against exact startDatetime interval
    const available = candidateSlots.filter((slot) => {
      const slotStart = parseManilaDateTime(targetDate, slot);
      if (!slotStart) return false;
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      const slotBookingsCount = bookings.filter((b) => {
        if (b.startDatetime && b.endDatetime) {
          return new Date(b.startDatetime) < slotEnd && new Date(b.endDatetime) > slotStart;
        }
        return b.remarks && b.remarks.startsWith(`Time Slot: ${slot}`);
      }).length;

      return slotBookingsCount < slotCapacity;
    });

    return available;
  }

  /**
   * Updates the status of a schedule request.
   */
  async updateStatus(id, targetStatus, processedById, actorRole, actorParishId) {
    const original = await prisma.schedule.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!original) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      throw err;
    }

    // Idempotency: if already in the target status, no-op
    if (original.status === targetStatus) {
      return original;
    }

    // Authorization & Ownership checks
    if (actorRole === "PARISHIONER") {
      if (targetStatus !== "CANCELLED" || original.userId !== parseInt(processedById, 10)) {
        const err = new Error("Unauthorized to perform this status update.");
        err.statusCode = 403;
        throw err;
      }
    } else if (actorRole === "SECRETARY" || actorRole === "PRIEST") {
      if (original.parishId !== actorParishId) {
        const err = new Error("Unauthorized: Request belongs to a different parish.");
        err.statusCode = 403;
        throw err;
      }
    } else if (actorRole !== "DIOCESE_COORDINATOR") {
      const err = new Error("Unauthorized role.");
      err.statusCode = 403;
      throw err;
    }

    const updated = await prisma.schedule.update({
      where: { id: parseInt(id, 10) },
      data: {
        status: targetStatus,
        processedById: processedById ? parseInt(processedById, 10) : null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true, contactNumber: true } },
        parish: { select: { id: true, parishName: true } },
        processedBy: { select: { id: true, fullName: true } },
      },
    });

    // Notify parishioner of status update (staff-driven: no admin fan-out)
    await RequestNotificationService.notifyScheduleChange(
      updated.userId,
      updated.parishId,
      updated.id,
      updated.displayTitle || updated.eventType,
      targetStatus,
      null,
      false
    );

    // Audit log
    await AuditLogService.log(processedById, `Updated schedule request #${id} status from ${original.status} to ${targetStatus}`, null, false, {
      affectedTable: "Schedule",
      affectedRecordId: id,
      parishId: updated.parishId,
      previousValues: { status: original.status },
      newValues: { status: targetStatus }
    });

    return updated;
  }

  /**
   * Proposes an alternative date for a schedule request (Secretary -> Parishioner).
   */
  async proposeReschedule(id, { proposedDate, proposedStartDatetime, proposedEndDatetime, reason, actorId, actorRole, actorParishId }) {
    const original = await prisma.schedule.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!original) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      throw err;
    }

    // Authorization & Ownership checks
    if (actorRole === "SECRETARY" || actorRole === "PRIEST") {
      if (original.parishId !== actorParishId) {
        const err = new Error("Unauthorized: Request belongs to a different parish.");
        err.statusCode = 403;
        throw err;
      }
    } else if (actorRole !== "DIOCESE_COORDINATOR") {
      const err = new Error("Unauthorized: Only parish staff can propose reschedule.");
      err.statusCode = 403;
      throw err;
    }

    const updated = await prisma.schedule.update({
      where: { id: parseInt(id, 10) },
      data: {
        status: "PROPOSED_RESCHEDULE",
        proposedDate: proposedDate ? new Date(proposedDate) : null,
        proposedStartDatetime: proposedStartDatetime ? new Date(proposedStartDatetime) : null,
        proposedEndDatetime: proposedEndDatetime ? new Date(proposedEndDatetime) : null,
        rescheduleReason: reason || null,
        processedById: actorId ? parseInt(actorId, 10) : null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        parish: { select: { id: true, parishName: true } },
      },
    });

    await RequestNotificationService.notifyScheduleChange(
      updated.userId,
      updated.parishId,
      updated.id,
      `${updated.displayTitle || updated.eventType} (Alternative Date Proposed)`,
      "PROPOSED_RESCHEDULE",
      null,
      false
    );

    // Audit log
    await AuditLogService.log(actorId, `Proposed rescheduling schedule request #${id} to ${proposedDate}`, null, false, {
      affectedTable: "Schedule",
      affectedRecordId: id,
      parishId: updated.parishId,
      previousValues: { status: original.status, proposedDate: original.proposedDate },
      newValues: { status: "PROPOSED_RESCHEDULE", proposedDate, rescheduleReason: reason }
    });

    return updated;
  }

  /**
   * Responds to a proposed reschedule (Parishioner -> Accept / Decline).
   */
  async respondReschedule(id, accept, actorId, actorRole) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      throw err;
    }

    // Idempotency: if already responded and confirmed/cancelled, no-op
    if (schedule.status === "CONFIRMED" || schedule.status === "CANCELLED") {
      return schedule;
    }

    // Authorization & Ownership checks
    if (actorRole === "PARISHIONER") {
      if (schedule.userId !== parseInt(actorId, 10)) {
        const err = new Error("Unauthorized to respond to this reschedule proposal.");
        err.statusCode = 403;
        throw err;
      }
    }

    let data = {};
    if (accept) {
      data = {
        status: "CONFIRMED",
        requestedDate: schedule.proposedDate || schedule.requestedDate,
        startDatetime: schedule.proposedStartDatetime || schedule.startDatetime,
        endDatetime: schedule.proposedEndDatetime || schedule.endDatetime,
      };
    } else {
      data = {
        status: "CANCELLED",
        remarks: `Reschedule proposal declined by parishioner. Original notes: ${schedule.remarks || ''}`,
      };
    }

    const updated = await prisma.schedule.update({
      where: { id: schedule.id },
      data,
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        parish: { select: { id: true, parishName: true } },
      },
    });

    // Notify parishioner + admins of status change
    await RequestNotificationService.notifyScheduleChange(
      updated.userId,
      updated.parishId,
      updated.id,
      updated.displayTitle || updated.eventType,
      updated.status,
      null,
      true
    );

    // Audit log
    await AuditLogService.log(updated.userId, `Responded to reschedule proposal for schedule request #${id}: ${accept ? "ACCEPTED" : "DECLINED"}`, null, false, {
      affectedTable: "Schedule",
      affectedRecordId: id,
      parishId: updated.parishId,
      previousValues: { status: schedule.status },
      newValues: { status: updated.status }
    });

    return updated;
  }

  /**
   * Assigns a priest (primary or assistant) to a schedule event.
   */
  async assignPriest(id, priestId, actorId, actorRole, actorParishId) {
    const parsedId = parseInt(id, 10);
    const parsedPriestId = parseInt(priestId, 10);

    const original = await prisma.schedule.findUnique({
      where: { id: parsedId },
    });

    if (!original) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      throw err;
    }

    // Idempotency: if priest is already assigned, no-op
    if (original.assignedPriestId === parsedPriestId) {
      return original;
    }

    // Authorization & Ownership checks
    if (actorRole === "SECRETARY" || actorRole === "PRIEST") {
      if (original.parishId !== actorParishId) {
        const err = new Error("Unauthorized: Request belongs to a different parish.");
        err.statusCode = 403;
        throw err;
      }
    } else if (actorRole !== "DIOCESE_COORDINATOR") {
      const err = new Error("Unauthorized role.");
      err.statusCode = 403;
      throw err;
    }

    const checkDate = original.proposedDate || original.requestedDate;
    let start = original.proposedStartDatetime || original.startDatetime;
    let end = original.proposedEndDatetime || original.endDatetime;

    if (!start && original.remarks) {
      const match = original.remarks.match(/Time Slot:\s*(\d{2}:\d{2}\s*[AP]M)/);
      if (match) {
        start = parseManilaDateTime(checkDate, match[1]);
        end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null;
      }
    }

    await ConflictHelper.checkPriestConflict(parsedPriestId, checkDate, start, end, { excludeScheduleId: parsedId, actorId });

    const updated = await prisma.schedule.update({
      where: { id: parsedId },
      data: {
        assignedPriestId: parsedPriestId,
        processedById: actorId ? parseInt(actorId, 10) : null,
      },
      include: {
        user: { select: { id: true, fullName: true, email: true } },
        assignedPriest: { select: { id: true, fullName: true, email: true } },
        parish: { select: { id: true, parishName: true } },
      },
    });

    // Send notifications to both parishioner and priest
    await RequestNotificationService.notifyPriestAssigned(
      updated.userId,
      updated.parishId,
      updated.id,
      updated.displayTitle || updated.eventType,
      updated.assignedPriestId,
      updated.assignedPriest?.fullName || "TBD",
      null
    );

    // Audit log
    await AuditLogService.log(actorId, `Assigned priest ${updated.assignedPriest?.fullName || 'TBD'} to schedule request #${id}`, null, false, {
      affectedTable: "Schedule",
      affectedRecordId: id,
      parishId: updated.parishId,
      previousValues: original ? { assignedPriestId: original.assignedPriestId } : null,
      newValues: { assignedPriestId: priestId }
    });

    return updated;
  }

  /**
   * Respond to priest assignment (Priest -> Accept / Reject).
   */
  async respondPriestAssignment(id, priestId, status, reason) {
    return PriestAssignmentHandler.handleResponse(id, priestId, status, reason, "SCHEDULE");
  }
}

