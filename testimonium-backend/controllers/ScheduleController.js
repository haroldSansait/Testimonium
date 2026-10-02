import { ScheduleService } from "../services/ScheduleService.js";
import { resolveEventMetadata, resolveEventType } from "../shared/EventTypeCatalog.js";
import { CANONICAL_SCHEDULE_EVENT_TYPES } from "../services/BookingValidator.js";
import { prisma } from "../config/db.js";
import { isProfileIncomplete } from "../utils/profileCompleteness.js";
import { isEffectivelyVerified } from "../utils/governmentIdVerificationHelper.js";
import {
  getScheduleRecommendations,
  getEligiblePriestsForParish,
  normalizeParishId,
} from "../services/ScheduleAvailabilityDomainService.js";

const scheduleService = new ScheduleService();

export const list = async (req, res, next) => {
  try {
    const { page, limit, search, status, scope } = req.query;

    // Scoping check: parishioners see only their own schedules.
    // Staff see schedules from their parish, and diocese coordinator sees all.
    let userId;
    let parishId;
    let priestId;

    if (req.user.role === "PARISHIONER") {
      userId = req.user.id;
    } else if (req.user.role === "PRIEST") {
      parishId = req.user.parish?.id || req.user.parishId;
      priestId = req.user.id;
    } else if (req.user.role !== "DIOCESE_COORDINATOR") {
      parishId = req.user.parish?.id || req.user.parishId;
    }

    const { data, total } = await scheduleService.list({
      page,
      limit,
      search,
      status,
      parishId,
      userId,
      priestId,
      scope,
    });

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    return next(err);
  }
};

export const getById = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    const data = await scheduleService.getById(id, actorId, actorRole, actorParishId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const getByTracking = async (req, res, next) => {
  try {
    const { reference } = req.params;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    const data = await scheduleService.getByTrackingReference(reference, actorId, actorRole, actorParishId);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { parishId, eventType, date, timeSlot, remarks, requestedPriestId } = req.body;
    const idempotencyKey = req.headers["idempotency-key"] || null;

    // Profile completion requirement for parishioners
    if (req.user.role === "PARISHIONER") {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { governmentIdVerification: true },
      });
      if (isProfileIncomplete(user)) {
        return res.status(403).json({
          success: false,
          code: "PROFILE_INCOMPLETE",
          message: "Please complete your profile details (full name and contact number) before scheduling an appointment.",
        });
      }
      if (!isEffectivelyVerified(user?.governmentIdVerification)) {
        return res.status(403).json({
          success: false,
          code: "IDENTITY_NOT_VERIFIED",
          message: "Please verify your Government ID before scheduling an appointment.",
        });
      }
    }

    // Staff role isolation check: Secretary/Priest can only schedule within their assigned parish
    if (["SECRETARY", "PRIEST", "STAFF"].includes(req.user.role)) {
      const staffParishId = req.user.parish?.id || req.user.parishId;
      if (staffParishId && Number(parishId) !== Number(staffParishId)) {
        return res.status(403).json({
          success: false,
          message: "Staff members may only create schedule appointments for their assigned parish.",
        });
      }
    }

    const canonicalEventType = resolveEventType(eventType);
    const resolvedDisplayTitle = resolveEventMetadata(canonicalEventType)?.title || canonicalEventType;

    const result = await scheduleService.create({
      userId,
      parishId,
      eventType: canonicalEventType,
      displayTitle: resolvedDisplayTitle,
      requestedDate: date,
      timeSlot,
      remarks,
      requestedPriestId,
    }, idempotencyKey);

    return res.status(201).json({
      success: true,
      message: result.isReplay ? "Schedule request replayed from idempotency key." : "Schedule request booked successfully.",
      data: result.schedule,
    });
  } catch (err) {
    return next(err);
  }
};

export const getConfiguration = async (req, res, next) => {
  try {
    const { parishId } = req.query;
    if (!parishId) {
      return res.status(400).json({
        success: false,
        message: "parishId query parameter is required.",
      });
    }

    if (["SECRETARY", "PRIEST", "STAFF"].includes(req.user.role)) {
      const staffParishId = req.user.parish?.id || req.user.parishId;
      if (staffParishId && Number(parishId) !== Number(staffParishId)) {
        return res.status(403).json({
          success: false,
          message: "Staff members may only view scheduling configuration for their assigned parish.",
        });
      }
    }

    const data = await scheduleService.getSchedulingConfiguration(parishId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getAvailabilityDates = async (req, res, next) => {
  try {
    const { parishId, eventType } = req.query;
    if (!parishId) {
      return res.status(400).json({
        success: false,
        message: "parishId query parameter is required.",
      });
    }

    // Staff role isolation check: Secretary/Priest can only query their own parish
    if (["SECRETARY", "PRIEST", "STAFF"].includes(req.user.role)) {
      const staffParishId = req.user.parish?.id || req.user.parishId;
      if (staffParishId && Number(parishId) !== Number(staffParishId)) {
        return res.status(403).json({
          success: false,
          message: "Staff members may only view availability for their assigned parish.",
        });
      }
    }

    const data = await scheduleService.getAvailabilityDates(parishId, eventType);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const getAvailableSlots = async (req, res, next) => {
  try {
    const { parishId, date, eventType } = req.query;
    if (!parishId || !date || !eventType) {
      return res.status(400).json({
        success: false,
        message: "parishId, date, and eventType query parameters are required.",
        errors: [],
      });
    }

    // Staff role isolation check: Secretary/Priest can only query their own parish
    if (["SECRETARY", "PRIEST", "STAFF"].includes(req.user.role)) {
      const staffParishId = req.user.parish?.id || req.user.parishId;
      if (staffParishId && Number(parishId) !== Number(staffParishId)) {
        return res.status(403).json({
          success: false,
          message: "Staff members may only view available slots for their assigned parish.",
        });
      }
    }

    const canonicalEventType = resolveEventType(eventType);
    if (!canonicalEventType || !CANONICAL_SCHEDULE_EVENT_TYPES.includes(canonicalEventType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid event type: '${eventType}'. Must be one of the 16 canonical schedule event types.`,
        errors: [],
      });
    }

    const slots = await scheduleService.getAvailableSlots(parishId, date, canonicalEventType);

    return res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (err) {
    return next(err);
  }
};

export const getRecommendations = async (req, res, next) => {
  try {
    const {
      parishId,
      eventType,
      preferredDate,
      dateFrom,
      dateTo,
      preferredTimeSlot,
      requestedPriestId,
    } = req.body;

    const result = await getScheduleRecommendations(
      {
        parishId,
        eventType,
        preferredDate,
        dateFrom,
        dateTo,
        preferredTimeSlot,
        requestedPriestId,
      },
      req.user
    );

    return res.status(200).json(result);
  } catch (err) {
    return next(err);
  }
};

export const getEligiblePriests = async (req, res, next) => {
  try {
    const { parishId } = req.query;
    if (!parishId) {
      return res.status(400).json({
        success: false,
        message: "parishId query parameter is required.",
      });
    }

    const parsedParishId = normalizeParishId(parishId);
    const data = await getEligiblePriestsForParish(parsedParishId, req.user);

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err) {
    return next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, expectedVersion } = req.body;
    const processedById = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required.",
      });
    }

    const updated = await scheduleService.updateStatus(id, status, processedById, actorRole, actorParishId, expectedVersion);

    return res.status(200).json({
      success: true,
      message: "Schedule request status updated successfully.",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

export const proposeReschedule = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { proposedDate, proposedStartDatetime, proposedEndDatetime, reason, expectedVersion } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    const updated = await scheduleService.proposeReschedule(id, {
      proposedDate,
      proposedStartDatetime,
      proposedEndDatetime,
      reason,
      actorId,
      actorRole,
      actorParishId,
      expectedVersion,
    });

    return res.status(200).json({
      success: true,
      message: "Alternative schedule date proposed successfully.",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

export const respondReschedule = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { accept, expectedVersion } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;

    const updated = await scheduleService.respondReschedule(id, accept, actorId, actorRole, expectedVersion);

    return res.status(200).json({
      success: true,
      message: accept ? "Reschedule proposal accepted." : "Reschedule proposal declined.",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

export const assignPriest = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { priestId, expectedVersion } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    const updated = await scheduleService.assignPriest(id, priestId, actorId, actorRole, actorParishId, expectedVersion);

    return res.status(200).json({
      success: true,
      message: "Priest assigned successfully.",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

export const getPriestAvailability = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    const results = await scheduleService.getPriestAvailability(id, {
      actorId,
      actorRole,
      actorParishId,
      candidateDate: req.query.date,
      candidateTime: req.query.time,
      candidateStartDatetime: req.query.startDatetime,
    });

    return res.status(200).json({
      success: true,
      data: results,
    });
  } catch (err) {
    return next(err);
  }
};

export const respondPriestAssignment = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reason, expectedVersion } = req.body;
    const priestId = req.user.id;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    if (!status || !["ACCEPTED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status is required and must be either ACCEPTED or REJECTED.",
      });
    }

    const updated = await scheduleService.respondPriestAssignment(id, priestId, status, reason, expectedVersion);

    return res.status(200).json({
      success: true,
      message: `Schedule assignment ${status.toLowerCase()} successfully.`,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

export const emergencyReschedule = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { targetDate, timeSlot, reason, expectedVersion } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    if (isNaN(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid schedule ID.",
      });
    }

    const updated = await scheduleService.emergencyReschedule(id, {
      targetDate,
      timeSlot,
      reason,
      actorId,
      actorRole,
      actorParishId,
      expectedVersion,
    });

    return res.status(200).json({
      success: true,
      message: "Schedule request emergency-rescheduled successfully.",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};
