import { prisma } from "../config/db.js";
import {
  getManilaDateString,
  massTemplateAppliesOnDate,
  parseManilaDateOnly,
  parseManilaDateTime,
} from "./ConflictHelper.js";
import { normalizePriestId } from "./SchedulingAvailability.js";

function combineDateAndTime(date, timeStr) {
  return parseManilaDateTime(date, timeStr);
}

function getThirdSaturdayOfMonth(year, month) {
  const d = new Date(year, month, 1);
  let saturdayCount = 0;
  while (saturdayCount < 3) {
    if (d.getDay() === 6) {
      saturdayCount++;
      if (saturdayCount === 3) {
        return new Date(d);
      }
    }
    d.setDate(d.getDate() + 1);
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
        location: e.location,
        visibility: e.visibility,
        version: e.version,
      };
    });

    // Inject Vicariate Meeting on the third Saturday of Jan, Apr, Jul, Oct if not present in DB
    const targetMonthIndex = parsedMonth - 1; // 0-indexed
    if ([0, 3, 6, 9].includes(targetMonthIndex)) {
      const thirdSatDate = getThirdSaturdayOfMonth(parsedYear, targetMonthIndex);
      const hasVicariateMeeting = dbParishEvents.some(
        (e) => e.eventType === "VICARIATE_MEETING" || e.title.includes("Vicariate Meeting")
      );

      if (!hasVicariateMeeting) {
        const defaultParish = await prisma.parish.findFirst({ select: { id: true, parishName: true } });
        const defaultParishId = defaultParish ? defaultParish.id : 1;
        const defaultParishName = defaultParish ? defaultParish.parishName : "Vicariate Center";

        eventsMapped.push({
          id: `event-vicariate-meeting-${parsedYear}-${parsedMonth}`,
          eventType: "OTHER",
          displayTitle: "Vicariate Meeting",
          requestedDate: thirdSatDate.toISOString(),
          startDatetime: combineDateAndTime(thirdSatDate, "09:00 AM").toISOString(),
          endDatetime: combineDateAndTime(thirdSatDate, "12:00 PM").toISOString(),
          status: "CONFIRMED",
          user: null,
          parish: { parishName: defaultParishName },
          processedBy: null,
          assignedPriest: null,
          remarks: "Quarterly assembly for vicariate coordinators and parish representatives.",
          sourceType: "PARISH_EVENT",
          location: "Vicariate Pastoral Center (Default)",
          visibility: "PUBLIC",
          version: null,
        });
      }
    }

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

  /**
   * Evaluates ongoing status for a schedule/calendar item based on authoritative start and end.
   */
  static evaluateOngoing({ start, end, status, hasEstimatedEnd = false, now = new Date() }) {
    if (status === "CANCELLED" || status === "REJECTED") {
      return { isOngoing: false, isOngoingEligible: false };
    }
    if (!start || !end || hasEstimatedEnd) {
      return { isOngoing: false, isOngoingEligible: false };
    }
    const startDate = start instanceof Date ? start : new Date(start);
    const endDate = end instanceof Date ? end : new Date(end);
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate.getTime() <= startDate.getTime()) {
      return { isOngoing: false, isOngoingEligible: false };
    }
    const isOngoing = now.getTime() >= startDate.getTime() && now.getTime() < endDate.getTime();
    return { isOngoing, isOngoingEligible: true };
  }

  /**
   * Priest-specific backend projection.
   * Sources:
   * 1. Assigned Schedules (excluding cancelled/rejected)
   * 2. Assigned ParishEvents (active)
   * 3. Assigned recurring Mass occurrences (where priest not on leave)
   * 4. PriestPersonalSchedule (private title & notes included for owner priest)
   * 5. PRIEST_LEAVE
   */
  async getPriestCalendar(priestId, { year, month, startDate, endDate } = {}) {
    const parsedPriestId = normalizePriestId(priestId);

    let rangeStart;
    let rangeEnd;

    if (year && month) {
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
      const nextYear = parsedMonth === 12 ? parsedYear + 1 : parsedYear;
      const nextMonth = parsedMonth === 12 ? 1 : parsedMonth + 1;
      rangeStart = new Date(
        `${parsedYear}-${String(parsedMonth).padStart(2, "0")}-01T00:00:00.000+08:00`
      );
      rangeEnd = new Date(
        `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000+08:00`
      );
    } else if (startDate && endDate) {
      rangeStart = new Date(startDate);
      rangeEnd = new Date(endDate);
      if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
        const error = new Error("Invalid startDate or endDate.");
        error.statusCode = 400;
        throw error;
      }
    } else {
      const manilaToday = parseManilaDateOnly(getManilaDateString(new Date()));
      const nextYear = manilaToday.month === 12 ? manilaToday.year + 1 : manilaToday.year;
      const nextMonth = manilaToday.month === 12 ? 1 : manilaToday.month + 1;
      rangeStart = new Date(
        `${manilaToday.year}-${String(manilaToday.month).padStart(2, "0")}-01T00:00:00.000+08:00`
      );
      rangeEnd = new Date(
        `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00.000+08:00`
      );
    }

    const now = new Date();

    // 1. Assigned Schedule requests (privacy safe - no sensitive parishioner PII)
    const schedules = await prisma.schedule.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        status: { notIn: ["CANCELLED", "REJECTED"] },
        requestedDate: { gte: rangeStart, lt: rangeEnd },
      },
      include: {
        parish: { select: { parishName: true } },
      },
    });

    const mappedSchedules = schedules.map((s) => {
      // Schedule endDatetime currently comes from a legacy operational
      // fallback, not an Admin-configured duration contract.
      const ongoing = CalendarService.evaluateOngoing({
        start: s.startDatetime,
        end: null,
        status: s.status,
        hasEstimatedEnd: true,
        now,
      });

      return {
        id: `schedule-${s.id}`,
        scheduleId: s.id,
        eventType: s.eventType,
        displayTitle: s.displayTitle || s.eventType,
        requestedDate: s.requestedDate.toISOString(),
        startDatetime: s.startDatetime ? s.startDatetime.toISOString() : null,
        endDatetime: s.endDatetime ? s.endDatetime.toISOString() : null,
        status: s.status,
        priestResponseStatus: s.priestResponseStatus,
        parish: s.parish ? { parishName: s.parish.parishName } : null,
        remarks: null,
        sourceType: "APPOINTMENT",
        isOngoing: ongoing.isOngoing,
        isOngoingEligible: ongoing.isOngoingEligible,
      };
    });

    // 2. Assigned ParishEvents
    const events = await prisma.parishEvent.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        isActive: true,
        eventDate: { gte: rangeStart, lt: rangeEnd },
      },
      include: {
        parish: { select: { parishName: true } },
      },
    });

    const mappedEvents = events.map((e) => {
      const start = e.startTime ? combineDateAndTime(e.eventDate, e.startTime) : null;
      const end = e.endTime ? combineDateAndTime(e.eventDate, e.endTime) : null;
      const hasAuthoritativeEnd = Boolean(e.endTime);
      const ongoing = CalendarService.evaluateOngoing({
        start,
        end: hasAuthoritativeEnd ? end : null,
        status: "CONFIRMED",
        hasEstimatedEnd: !hasAuthoritativeEnd,
        now,
      });

      return {
        id: `event-${e.id}`,
        eventId: e.id,
        eventType: e.eventType,
        displayTitle: e.title,
        requestedDate: e.eventDate.toISOString(),
        startDatetime: start ? start.toISOString() : null,
        endDatetime: end ? end.toISOString() : null,
        status: "CONFIRMED",
        parish: e.parish ? { parishName: e.parish.parishName } : null,
        remarks: e.description,
        sourceType: "PARISH_EVENT",
        location: e.location,
        isOngoing: ongoing.isOngoing,
        isOngoingEligible: ongoing.isOngoingEligible,
      };
    });

    // 3. PRIEST_LEAVE in ParishAvailability
    const leaves = await prisma.parishAvailability.findMany({
      where: {
        userId: parsedPriestId,
        type: "PRIEST_LEAVE",
        startDate: { lt: rangeEnd },
        endDate: { gte: rangeStart },
      },
      include: {
        parish: { select: { parishName: true } },
      },
    });

    const mappedLeaves = leaves.map((l) => ({
      id: `leave-${l.id}`,
      eventType: l.type,
      displayTitle: l.title,
      requestedDate: l.startDate.toISOString(),
      startDatetime: l.startDate.toISOString(),
      endDatetime: l.endDate.toISOString(),
      status: "CONFIRMED",
      parish: l.parish ? { parishName: l.parish.parishName } : null,
      remarks: l.description || "Priest on Leave",
      sourceType: "AVAILABILITY",
      isOngoing: false,
      isOngoingEligible: false,
    }));

    // 4. Assigned recurring Mass occurrences
    const massTemplates = await prisma.massScheduleTemplate.findMany({
      where: {
        assignedPriestId: parsedPriestId,
        isActive: true,
      },
      include: {
        parish: { select: { parishName: true } },
      },
    });

    const mappedMass = [];
    if (massTemplates.length > 0) {
      const firstDate = parseManilaDateOnly(rangeStart);
      const lastDate = parseManilaDateOnly(new Date(rangeEnd.getTime() - 1));

      if (firstDate && lastDate) {
        for (
          let cursor = Date.UTC(firstDate.year, firstDate.month - 1, firstDate.day);
          cursor <= Date.UTC(lastDate.year, lastDate.month - 1, lastDate.day);
          cursor += 24 * 60 * 60 * 1000
        ) {
          const dateStr = new Date(cursor).toISOString().slice(0, 10);
          const dayTemplates = massTemplates.filter((template) =>
            massTemplateAppliesOnDate(template.dayType, dateStr)
          );

          for (const template of dayTemplates) {
            const isOnLeave = leaves.some((leave) =>
              getManilaDateString(leave.startDate) <= dateStr
              && getManilaDateString(leave.endDate) >= dateStr
            );
            if (isOnLeave) continue;

            const start = combineDateAndTime(dateStr, template.timeSlot);
            mappedMass.push({
              id: `mass-${template.id}-${dateStr}`,
              eventType: "MASS_INTENTION",
              displayTitle: template.label || "Holy Mass",
              requestedDate: new Date(`${dateStr}T00:00:00.000+08:00`).toISOString(),
              startDatetime: start ? start.toISOString() : null,
              endDatetime: null,
              status: "CONFIRMED",
              parish: template.parish ? { parishName: template.parish.parishName } : null,
              remarks: "Recurring Parish Mass Schedule",
              sourceType: "MASS",
              isOngoing: false,
              isOngoingEligible: false,
            });
          }
        }
      }
    }

    // 5. PriestPersonalSchedule entries
    const personalSchedules = await prisma.priestPersonalSchedule.findMany({
      where: {
        priestId: parsedPriestId,
        startAt: { lt: rangeEnd },
        endAt: { gt: rangeStart },
      },
      orderBy: { startAt: "asc" },
    });

    const mappedPersonal = personalSchedules.map((p) => {
      const ongoing = CalendarService.evaluateOngoing({
        start: p.startAt,
        end: p.endAt,
        status: "CONFIRMED",
        hasEstimatedEnd: false,
        now,
      });

      return {
        id: `personal-${p.id}`,
        personalId: p.id,
        eventType: "PERSONAL",
        displayTitle: p.title,
        notes: p.notes,
        requestedDate: p.startAt.toISOString(),
        startDatetime: p.startAt.toISOString(),
        endDatetime: p.endAt.toISOString(),
        status: "CONFIRMED",
        version: p.version,
        remarks: p.notes,
        sourceType: "PERSONAL",
        isOngoing: ongoing.isOngoing,
        isOngoingEligible: ongoing.isOngoingEligible,
      };
    });

    const combined = [
      ...mappedLeaves,
      ...mappedMass,
      ...mappedEvents,
      ...mappedSchedules,
      ...mappedPersonal,
    ];

    combined.sort((a, b) => {
      const aTime = a.startDatetime ? new Date(a.startDatetime).getTime() : 0;
      const bTime = b.startDatetime ? new Date(b.startDatetime).getTime() : 0;
      return aTime - bTime;
    });

    return combined;
  }
}
