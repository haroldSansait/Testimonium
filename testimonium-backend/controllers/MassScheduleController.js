import { MassScheduleService } from "../services/MassScheduleService.js";

const service = new MassScheduleService();

export const list = async (req, res, next) => {
  try {
    const parishId = req.params.parishId || req.user.parish?.id;
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
    const parishId = req.params.parishId || req.user.parish?.id;
    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required." });
    }

    const actorId = req.user.id;
    const { id, dayType, timeSlot, label, assignedPriestId } = req.body;

    const data = await service.upsertTemplate(parishId, { id, dayType, timeSlot, label, assignedPriestId, actorId });
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const remove = async (req, res, next) => {
  try {
    const { id } = req.params;
    const actorId = req.user.id;

    await service.deleteTemplate(id, actorId);
    return res.status(200).json({ success: true, message: "Mass schedule template deleted successfully." });
  } catch (err) {
    return next(err);
  }
};

export const reset = async (req, res, next) => {
  try {
    const parishId = req.params.parishId || req.user.parish?.id;
    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required." });
    }

    const actorId = req.user.id;
    
    await service.resetDefaults(parishId, actorId);
    
    const data = await service.getTemplates(parishId);
    return res.status(200).json({ success: true, message: "Default Mass schedule restored successfully.", data });
  } catch (err) {
    return next(err);
  }
};
