import { ScheduleRepository } from "../repositories/ScheduleRepository.js";
import { prisma } from "../config/db.js";
import { RequestNotificationService } from "./RequestNotificationService.js";

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
    // Save the selected time slot in the remarks or separate structure. Here we append to remarks
    const finalRemarks = `Time Slot: ${timeSlot}. ${remarks}`.trim();

    const schedule = await prisma.schedule.create({
      data: {
        userId: parseInt(userId, 10),
        parishId: parseInt(parishId, 10),
        eventType,
        displayTitle,
        requestedDate: new Date(requestedDate),
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

    return schedule;
  }

  /**
   * Calculates available slots for a parish on a given date by subtracting booked slots.
   */
  async getAvailableSlots(parishId, date) {
    const parsedParishId = parseInt(parishId, 10);
    const targetDate = new Date(date);

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

    return updated;
  }
}

