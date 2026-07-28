import { ScheduleService } from "../services/ScheduleService.js";
import { resolveEventType } from "../shared/EventTypeCatalog.js";

const scheduleService = new ScheduleService();

export const list = async (req, res, next) => {
  try {
    const { page, limit, search, status } = req.query;
    
    // Scoping check: parishioners see only their own schedules.
    // Staff see schedules from their parish, and diocese coordinator sees all.
    let userId;
    let parishId;
    let priestId;

    if (req.user.role === "PARISHIONER") {
      userId = req.user.id;
    } else if (req.user.role === "PRIEST") {
      parishId = req.user.parish?.id;
      priestId = req.user.id;
    } else if (req.user.role !== "DIOCESE_COORDINATOR") {
      parishId = req.user.parish?.id;
    }

    const { data, total } = await scheduleService.list({
      page,
      limit,
      search,
      status,
      parishId,
      userId,
      priestId,
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

export const create = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { parishId, eventType, date, timeSlot, displayTitle, remarks } = req.body;

    const canonicalEventType = resolveEventType(eventType);
    const resolvedDisplayTitle = displayTitle || eventType;

    const schedule = await scheduleService.create({
      userId,
      parishId,
      eventType: canonicalEventType,
      displayTitle: resolvedDisplayTitle,
      requestedDate: date,
      timeSlot,
      remarks,
    });

    return res.status(201).json({
      success: true,
      message: "Schedule request booked successfully.",
      data: schedule,
    });
  } catch (err) {
    return next(err);
  }
};

export const getAvailableSlots = async (req, res, next) => {
  try {
    const { parishId, date } = req.query;
    if (!parishId || !date) {
      return res.status(400).json({
        success: false,
        message: "parishId and date query parameters are required.",
        errors: [],
      });
    }

    const slots = await scheduleService.getAvailableSlots(parishId, date);

    return res.status(200).json({
      success: true,
      data: slots,
    });
  } catch (err) {
    return next(err);
  }
};

export const updateStatus = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status } = req.body;
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

    const updated = await scheduleService.updateStatus(id, status, processedById, actorRole, actorParishId);

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
    const { proposedDate, proposedStartDatetime, proposedEndDatetime, reason } = req.body;
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
    const { accept } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;

    const updated = await scheduleService.respondReschedule(id, accept, actorId, actorRole);

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
    const { priestId } = req.body;
    const actorId = req.user.id;
    const actorRole = req.user.role;
    const actorParishId = req.user.parish?.id || req.user.parishId;

    const updated = await scheduleService.assignPriest(id, priestId, actorId, actorRole, actorParishId);

    return res.status(200).json({
      success: true,
      message: "Priest assigned successfully.",
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

export const respondPriestAssignment = async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { status, reason } = req.body;
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

    const updated = await scheduleService.respondPriestAssignment(id, priestId, status, reason);

    return res.status(200).json({
      success: true,
      message: `Schedule assignment ${status.toLowerCase()} successfully.`,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};


