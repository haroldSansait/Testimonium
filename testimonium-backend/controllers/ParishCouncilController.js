import { ParishCouncilService } from "../services/ParishCouncilService.js";
import { validateParishAccess } from "../utils/tenantGuard.js";

const councilService = new ParishCouncilService();

export const getSelector = async (req, res, next) => {
  try {
    const data = await councilService.getSelectorParishes(req.user);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const getCouncilConfig = async (req, res, next) => {
  try {
    const { id } = req.params;
    await validateParishAccess(req, id, "Parish Council Configuration");
    const data = await councilService.getCouncilConfig(id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};

export const saveCouncil = async (req, res, next) => {
  try {
    const { id } = req.params;
    await validateParishAccess(req, id, "Parish Council Configuration");
    const data = await councilService.saveCouncil(id, req.body, req.user?.id);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    return next(err);
  }
};
