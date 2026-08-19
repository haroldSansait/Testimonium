import { ParishEventService } from "../services/ParishEventService.js";
import { prisma } from "../config/db.js";
import { getEffectiveParishId, validateParishAccess } from "../utils/tenantGuard.js";

const service = new ParishEventService();

export const list = async (req, res, next) => {
  try {
    const { year, month } = req.query;
    let parishId = req.params.parishId || req.user.parish?.id;

    if (!parishId || !year || !month) {
      return res.status(400).json({
        success: false,
        message: "parishId, year, and month are required."
      });
    }

    if (req.user.role !== "DIOCESE_COORDINATOR") {
      parishId = req.user.parish?.id;
      if (req.params.parishId && parseInt(req.params.parishId, 10) !== parishId) {
        await validateParishAccess(req, req.params.parishId, "Parish Event List");
      }
    }

    const data = await service.getEvents(parishId, year, month);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const create = async (req, res, next) => {
  try {
    let parishId = getEffectiveParishId(req, req.body.parishId);
    if (req.user.role === "DIOCESE_COORDINATOR" && !parishId) {
      const defaultParish = await prisma.parish.findFirst({ select: { id: true } });
      if (defaultParish) {
        parishId = defaultParish.id;
      }
    }

    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required for this action." });
    }

    await validateParishAccess(req, parishId, "Parish Event Creation");

    const actorId = req.user.id;
    const data = await service.createEvent(parishId, req.body, actorId);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const update = async (req, res, next) => {
  try {
    const parsedId = parseInt(req.params.id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    const original = await prisma.parishEvent.findUnique({
      where: { id: parsedId }
    });
    if (!original) {
      return res.status(404).json({ success: false, message: "Parish event not found." });
    }

    await validateParishAccess(req, original.parishId, "Parish Event Update");

    const actorId = req.user.id;
    const data = await service.updateEvent(parsedId, req.body, actorId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const parsedId = parseInt(req.params.id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: "Invalid event ID." });
    }

    const original = await prisma.parishEvent.findUnique({
      where: { id: parsedId }
    });
    if (!original) {
      return res.status(404).json({ success: false, message: "Parish event not found." });
    }

    await validateParishAccess(req, original.parishId, "Parish Event Deletion");

    const actorId = req.user.id;
    await service.deleteEvent(parsedId, actorId);
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
