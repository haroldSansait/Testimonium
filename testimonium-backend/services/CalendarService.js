import { prisma } from "../config/db.js";

function combineDateAndTime(date, timeStr) {
  try {
    const d = new Date(date);
    let [hourMin, period] = timeStr.split(" ");
    let [hours, minutes] = hourMin.split(":").map(Number);
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    d.setHours(hours, minutes, 0, 0);
    return d;
  } catch (err) {
    return null;
  }
}

export class CalendarService {
  /**
   * Returns all schedule events for the given calendar month.
   * Unions Schedules, ParishEvents, and expanded recurring Mass schedule templates.
   */
  async getEvents(year, month, parishId) {
    const parsedYear = parseInt(year, 10);
    const parsedMonth = parseInt(month, 10);

    if (
      !Number.isInteger(parsedYear) ||
      !Number.isInteger(parsedMonth) ||
      parsedMonth < 1 ||
      parsedMonth > 12 ||
      parsedYear < 2000 ||
      parsedYear > 2100
    ) {
      const error = new Error("Invalid year or month. year must be 2000–2100, month must be 1–12.");
      error.statusCode = 400;
      throw error;
    }

    const startOfMonth = new Date(parsedYear, parsedMonth - 1, 1);
    const startOfNextMonth = new Date(parsedYear, parsedMonth, 1);

    // 1. Fetch Schedule requests
    const scheduleWhere = {
      requestedDate: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    };
    if (parishId) {
      scheduleWhere.parishId = parseInt(parishId, 10);
    }

    const dbSchedules = await prisma.schedule.findMany({
      where: scheduleWhere,
      include: {
        user: { select: { fullName: true } },
        parish: { select: { parishName: true } },
        processedBy: { select: { fullName: true } },
        assignedPriest: { select: { id: true, fullName: true, color: true } },
      },
    });

    const schedulesMapped = dbSchedules.map((s) => ({
      id: String(s.id),
      eventType: s.eventType,
      displayTitle: s.displayTitle,
      requestedDate: s.requestedDate.toISOString(),
      startDatetime: s.startDatetime ? s.startDatetime.toISOString() : null,
      endDatetime: s.endDatetime ? s.endDatetime.toISOString() : null,
      status: s.status,
      user: s.user ? { fullName: s.user.fullName } : null,
      parish: s.parish ? { parishName: s.parish.parishName } : null,
      processedBy: s.processedBy ? { fullName: s.processedBy.fullName } : null,
      assignedPriest: s.assignedPriest ? {
        id: s.assignedPriest.id,
        fullName: s.assignedPriest.fullName,
        color: s.assignedPriest.color,
      } : null,
      remarks: s.remarks,
      sourceType: "APPOINTMENT",
    }));

    // 2. Fetch Parish events
    const eventWhere = {
      isActive: true,
      eventDate: {
        gte: startOfMonth,
        lt: startOfNextMonth,
      },
    };
    if (parishId) {
      eventWhere.parishId = parseInt(parishId, 10);
    }

    const dbParishEvents = await prisma.parishEvent.findMany({
      where: eventWhere,
      include: {
        parish: { select: { parishName: true } },
        assignedPriest: { select: { id: true, fullName: true, color: true } },
      },
    });

    const eventsMapped = dbParishEvents.map((e) => {
      const start = e.startTime ? combineDateAndTime(e.eventDate, e.startTime) : null;
      const end = e.endTime ? combineDateAndTime(e.eventDate, e.endTime) : null;
      return {
        id: `event-${e.id}`,
        eventType: e.eventType,
        displayTitle: e.title,
        requestedDate: e.eventDate.toISOString(),
        startDatetime: start ? start.toISOString() : null,
        endDatetime: end ? end.toISOString() : null,
        status: "CONFIRMED",
        user: null,
        parish: e.parish ? { parishName: e.parish.parishName } : null,
        processedBy: e.assignedPriest ? { fullName: e.assignedPriest.fullName } : null,
        assignedPriest: e.assignedPriest ? {
          id: e.assignedPriest.id,
          fullName: e.assignedPriest.fullName,
          color: e.assignedPriest.color,
        } : null,
        remarks: e.description,
        sourceType: "PARISH_EVENT",
      };
    });

    // 3. Fetch recurring MassScheduleTemplates and expand
    const templateWhere = { isActive: true };
    if (parishId) {
      templateWhere.parishId = parseInt(parishId, 10);
    }

    const templates = await prisma.massScheduleTemplate.findMany({
      where: templateWhere,
      include: {
        parish: { select: { parishName: true } },
        assignedPriest: { select: { id: true, fullName: true, color: true } },
      },
    });

    // 4. Fetch Parish/Staff Availability blocks
    const availabilityWhere = {};
    if (parishId) {
      availabilityWhere.parishId = parseInt(parishId, 10);
    }
    availabilityWhere.startDate = { lte: startOfNextMonth };
    availabilityWhere.endDate = { gte: startOfMonth };

    const dbAvailabilities = await prisma.parishAvailability.findMany({
      where: availabilityWhere,
      include: {
        parish: { select: { parishName: true } },
        user: { select: { fullName: true } },
      },
    });

    const availabilitiesMapped = dbAvailabilities.map((av) => ({
      id: `availability-${av.id}`,
      eventType: av.type, // e.g. "PRIEST_LEAVE", "PARISH_CLOSED"
      displayTitle: av.title,
      requestedDate: av.startDate.toISOString(),
      startDatetime: av.startDate.toISOString(),
      endDatetime: av.endDate.toISOString(),
      status: "CONFIRMED",
      user: av.user ? { fullName: av.user.fullName } : null,
      parish: av.parish ? { parishName: av.parish.parishName } : null,
      processedBy: null,
      remarks: av.description || "Parish Leave/Availability block.",
      sourceType: "AVAILABILITY",
    }));

    const expandedMassEvents = [];
    const numDays = new Date(parsedYear, parsedMonth, 0).getDate();
    const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

    for (let day = 1; day <= numDays; day++) {
      const date = new Date(parsedYear, parsedMonth - 1, day);
      const dayOfWeek = date.getDay();
      const currentDayName = dayNames[dayOfWeek];

      const dailyTemplates = templates.filter((t) => {
        if (t.dayType === currentDayName) return true;
        // Keep compatibility with legacy WEEKDAY templates mapped to Wednesday and Friday
        if (t.dayType === "WEEKDAY" && (currentDayName === "WEDNESDAY" || currentDayName === "FRIDAY")) return true;
        return false;
      });

      for (const t of dailyTemplates) {
        const start = combineDateAndTime(date, t.timeSlot);
        const end = start ? new Date(start.getTime() + 60 * 60 * 1000) : null; // default 1 hour duration

        // Check if the assigned priest is on leave on this exact date
        let priestInfo = null;
        if (t.assignedPriest) {
          const isPriestOnLeave = dbAvailabilities.some(av => 
            av.userId === t.assignedPriestId &&
            av.type === "PRIEST_LEAVE" &&
            new Date(av.startDate) <= date &&
            new Date(av.endDate) >= date
          );
          if (!isPriestOnLeave) {
            priestInfo = {
              id: t.assignedPriest.id,
              fullName: t.assignedPriest.fullName,
              color: t.assignedPriest.color,
            };
          }
        }

        expandedMassEvents.push({
          id: `mass-${t.id}-${day}`,
          eventType: "MASS_INTENTION",
          displayTitle: t.label || "Holy Mass",
          requestedDate: date.toISOString(),
          startDatetime: start ? start.toISOString() : null,
          endDatetime: end ? end.toISOString() : null,
          status: "CONFIRMED",
          user: null,
          parish: { parishName: t.parish.parishName },
          processedBy: priestInfo ? { fullName: priestInfo.fullName } : null,
          assignedPriest: priestInfo,
          remarks: "Recurring Parish Mass Schedule",
          sourceType: "MASS",
        });
      }
    }

    // Combine all four sources, ordering by startDatetime or requestedDate
    const combined = [...expandedMassEvents, ...eventsMapped, ...schedulesMapped, ...availabilitiesMapped];
    
    // Sort: Availability blocks first, then Mass schedules, then parish events, then parishioner appointments
    combined.sort((a, b) => {
      const priority = { AVAILABILITY: 0, MASS: 1, PARISH_EVENT: 2, APPOINTMENT: 3 };
      const aPriority = priority[a.sourceType] !== undefined ? priority[a.sourceType] : 4;
      const bPriority = priority[b.sourceType] !== undefined ? priority[b.sourceType] : 4;
      if (aPriority !== bPriority) return aPriority - bPriority;
      
      const aTime = a.startDatetime ? new Date(a.startDatetime).getTime() : 0;
      const bTime = b.startDatetime ? new Date(b.startDatetime).getTime() : 0;
      return aTime - bTime;
    });

    return combined;
  }
}
