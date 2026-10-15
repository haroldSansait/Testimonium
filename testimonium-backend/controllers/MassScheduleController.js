import { MassScheduleService } from "../services/MassScheduleService.js";
import { prisma } from "../config/db.js";
import { validateParishAccess } from "../utils/tenantGuard.js";

const service = new MassScheduleService();

export const list = async (req, res, next) => {
  try {
    let parishId = req.params.parishId || req.query.parishId || req.user.parish?.id;
    if (req.user.role !== "DIOCESE_COORDINATOR") {
      parishId = req.user.parish?.id;
      if (req.params.parishId && parseInt(req.params.parishId, 10) !== parishId) {
        await validateParishAccess(req, req.params.parishId, "Mass Schedule Template List");
      }
    }

    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required." });
    }

    const data = await service.getTemplates(parishId);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const upsert = async (req, res, next) => {
  try {
    let parishId = req.params.parishId || req.body.parishId || req.user.parish?.id;
    if (req.user.role !== "DIOCESE_COORDINATOR") {
      parishId = req.user.parish?.id;
    }

    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required." });
    }

    await validateParishAccess(req, parishId, "Mass Schedule Template Upsert");

    const actorId = req.user.id;
    const { id, dayType, timeSlot, label, assignedPriestId, layMinisterAssigned, expectedUpdatedAt } = req.body;

    const data = await service.upsertTemplate(parishId, {
      id,
      dayType,
      timeSlot,
      label,
      assignedPriestId,
      layMinisterAssigned,
      expectedUpdatedAt,
      assignedPriestIdPresent: Object.prototype.hasOwnProperty.call(req.body, "assignedPriestId"),
      layMinisterAssignedPresent: Object.prototype.hasOwnProperty.call(req.body, "layMinisterAssigned"),
      actorId,
    });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const parsedId = parseInt(req.params.id, 10);
    if (isNaN(parsedId)) {
      return res.status(400).json({ success: false, message: "Invalid template ID." });
    }

    const original = await prisma.massScheduleTemplate.findUnique({
      where: { id: parsedId }
    });
    if (!original) {
      return res.status(404).json({ success: false, message: "Mass schedule template not found." });
    }

    await validateParishAccess(req, original.parishId, "Mass Schedule Template Deletion");

    const actorId = req.user.id;
    await service.deleteTemplate(parsedId, actorId);
    return res.status(200).json({ success: true, message: "Mass schedule template deleted successfully." });
  } catch (err) {
    return next(err);
  }
};

export const reset = async (req, res, next) => {
  try {
    let parishId = req.params.parishId || req.body.parishId || req.user.parish?.id;
    if (req.user.role !== "DIOCESE_COORDINATOR") {
      parishId = req.user.parish?.id;
    }

    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required." });
    }

    await validateParishAccess(req, parishId, "Mass Schedule Reset");

    const actorId = req.user.id;
    await service.resetDefaults(parishId, actorId);
    
    const data = await service.getTemplates(parishId);
    return res.status(200).json({ success: true, message: "Default Mass schedule restored successfully.", data });
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
        message: "Invalid template ID.",
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
      message: `Mass assignment ${status.toLowerCase()} successfully.`,
      data: updated,
    });
  } catch (err) {
    return next(err);
  }
};

export const occurrences = async (req, res, next) => {
  try {
    await validateParishAccess(req, req.params.parishId, "Mass Occurrence Availability");
    const data = await service.getOccurrences(req.params.parishId, req.query.from);
    return res.json({ success: true, data });
  } catch (error) { return next(error); }
};

export const changeOccurrence = (assign) => async (req, res, next) => {
  try {
    await validateParishAccess(req, req.params.parishId, "Mass Occurrence Lay Minister Assignment");
    const data = await service.setOccurrenceLayMinister(
      req.params.parishId, req.params.templateId, req.params.date, req.body, req.user.id, assign
    );
    return res.json({ success: true, data, message: assign
      ? "This occurrence alone is now designated Liturgy of the Word. The recurring template remains unchanged."
      : "The date-specific override was removed. This occurrence again follows its original Mass template." });
  } catch (error) { return next(error); }
};
