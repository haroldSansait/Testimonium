import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { prisma } from "../config/db.js";
import { RequestNotificationService } from "./RequestNotificationService.js";
import { AuditLogService } from "./AuditLogService.js";
import { ConflictHelper } from "./ConflictHelper.js";

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
  async list({ page = 1, limit = 10, search, status, parishId, userId } = {}) {
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

    if (status) {
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
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: parsedLimit,
      }),
      prisma.schedule.count({ where }),
    ]);

    return { data, total };
  }

  /**
   * Book a new schedule slot.
   */
  async create({ userId, parishId, eventType, displayTitle, requestedDate, timeSlot, remarks = "" }) {
    const parsedParishId = parseInt(parishId, 10);
    const targetDate = new Date(requestedDate);
    targetDate.setHours(0, 0, 0, 0);

    // Check if parish is closed or secretary is on leave
    const block = await prisma.parishAvailability.findFirst({
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

    const finalRemarks = `Time Slot: ${timeSlot}. ${remarks}`.trim();

    const schedule = await prisma.schedule.create({
      data: {
        userId: parseInt(userId, 10),
        parishId: parsedParishId,
        eventType,
        displayTitle,
        requestedDate: targetDate,
        remarks: finalRemarks,
        status: "PENDING",
      },
      include: {
        parish: { select: { id: true, parishName: true } },
      },
    });

    // Notify parishioner + admins of new booking
    await RequestNotificationService.notifyScheduleChange(
      parseInt(userId, 10),
      schedule.parishId,
      schedule.id,
      schedule.displayTitle || eventType,
      "PENDING",
      null, // no tx: create() runs outside a Prisma transaction
      true  // notifyAdmins: new booking needs staff awareness
    );

    // Audit log
    await AuditLogService.log(userId, `Booked a new schedule request: ${displayTitle || eventType}`, null, false, {
      affectedTable: "Schedule",
      affectedRecordId: schedule.id,
      parishId: schedule.parishId,
      newValues: { eventType, displayTitle, requestedDate, timeSlot, remarks }
    });

    return schedule;
  }

  /**
   * Calculates available slots for a parish on a given date by subtracting booked slots.
   */
  async getAvailableSlots(parishId, date) {
    const parsedParishId = parseInt(parishId, 10);
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    // Check parish availability block
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

    // Fetch existing bookings for that day
    const bookings = await prisma.schedule.findMany({
      where: {
        parishId: parsedParishId,
        requestedDate: {
          gte: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()),
          lt: new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() + 1),
        },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      select: { remarks: true },
    });

    const standardSlots = ["09:00 AM", "10:30 AM", "01:30 PM", "03:00 PM"];
    
    // Filter standard slots by checking if they are already found in booking remarks
    const available = standardSlots.filter((slot) => {
      const isBooked = bookings.some((b) => b.remarks && b.remarks.includes(`Time Slot: ${slot}`));
      return !isBooked;
    });

    return available;
  }

  /**
   * Updates the status of a schedule request.
   */
  async updateStatus(id, targetStatus, processedById) {
    const original = await prisma.schedule.findUnique({
      where: { id: parseInt(id, 10) },
    });

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
      null, // no tx: updateStatus() runs outside a Prisma transaction
      false // notifyAdmins: staff is performing this action, no admin fan-out
    );

    // Audit log
    await AuditLogService.log(processedById, `Updated schedule request #${id} status from ${original ? original.status : 'unknown'} to ${targetStatus}`, null, false, {
      affectedTable: "Schedule",
      affectedRecordId: id,
      parishId: updated.parishId,
      previousValues: original ? { status: original.status } : null,
      newValues: { status: targetStatus }
    });

    return updated;
  }

  /**
   * Proposes an alternative date for a schedule request (Secretary -> Parishioner).
   */
  async proposeReschedule(id, { proposedDate, proposedStartDatetime, proposedEndDatetime, reason, actorId }) {
    const original = await prisma.schedule.findUnique({
      where: { id: parseInt(id, 10) },
    });

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
      previousValues: original ? { status: original.status, proposedDate: original.proposedDate } : null,
      newValues: { status: "PROPOSED_RESCHEDULE", proposedDate, rescheduleReason: reason }
    });

    return updated;
  }

  /**
   * Responds to a proposed reschedule (Parishioner -> Accept / Decline).
   */
  async respondReschedule(id, accept) {
    const schedule = await prisma.schedule.findUnique({
      where: { id: parseInt(id, 10) },
    });

    if (!schedule) {
      const err = new Error("Schedule request not found.");
      err.statusCode = 404;
      throw err;
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
      true // notify admins too!
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
  async assignPriest(id, priestId, actorId) {
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

    const checkDate = original.proposedDate || original.requestedDate;
    let start = original.proposedStartDatetime || original.startDatetime;
    let end = original.proposedEndDatetime || original.endDatetime;

    if (!start && original.remarks) {
      const match = original.remarks.match(/Time Slot:\s*(\d{2}:\d{2}\s*[AP]M)/);
      if (match) {
        const timeStr = match[1];
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
        start = combine(checkDate, timeStr);
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
}

