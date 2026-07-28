import { ParishEventService } from "../services/ParishEventService.js";
import { prisma } from "../config/db.js";

const service = new ParishEventService();

export const list = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    const parishId = req.params.parishId || req.user.parish?.id;

    if (!parishId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: "parishId, year, and month are required."
      });
    }

    const data = await service.getEvents(parishId, year, month);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    let parishId = req.body.parishId || req.user.parish?.id;
    if (req.user.role === "DIOCESE_COORDINATOR" && !parishId) {
      const defaultParish = await prisma.parish.findFirst({ select: { id: true } });
      if (defaultParish) {
        parishId = defaultParish.id;
      }
    }

    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required for this action." });
    }

    const actorId = req.user.id;
    const data = await service.createEvent(parishId, req.body, actorId);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.user.id;
    const data = await service.updateEvent(id, req.body, actorId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.user.id;
    await service.deleteEvent(id, actorId);
    return res.status(200).json({ success: true, message: "Parish event deleted successfully." });
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
        message: "Invalid event ID.",
      });
    }

    if (!status || !["ACCEPTED", "REJECTED"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status is required and must be either ACCEPTED or REJECTED.",
      });
    }

    const updated = await service.respondPriestAssignment(id, priestId, status, reason);

    return res.status(200).json({
      success: true,
      message: `Event assignment ${status.toLowerCase()} successfully.`,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};
