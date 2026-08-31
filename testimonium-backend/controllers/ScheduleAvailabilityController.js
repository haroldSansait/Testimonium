import { ScheduleAvailabilityService } from "../services/ScheduleAvailabilityService.js";
import { getEffectiveParishId, validateParishAccess } from "../utils/tenantGuard.js";

const service = new ScheduleAvailabilityService();

function resolveParishId(req) {
  const parishId = getEffectiveParishId(req, req.params.parishId);
  if (!parishId) {
    const error = new Error("Parish ID is required.");
    error.statusCode = 400;
    error.code = "PARISH_ID_REQUIRED";
    throw error;
  }
  return parishId;
}

export async function getConfiguration(req, res, next) {
  try {
    const parishId = resolveParishId(req);
    await validateParishAccess(req, parishId, "Scheduling Availability Configuration");
    const data = await service.getConfiguration(parishId, req.query);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function replaceWeekdayRules(req, res, next) {
  try {
    const parishId = resolveParishId(req);
    await validateParishAccess(req, parishId, "Scheduling Weekday Rules");
    const data = await service.replaceWeekdayRules(parishId, req.body, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function createDateRule(req, res, next) {
  try {
    const parishId = resolveParishId(req);
    await validateParishAccess(req, parishId, "Scheduling Date Rule Creation");
    const data = await service.createDateRule(parishId, req.body, req.user.id);
    return res.status(201).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function updateDateRule(req, res, next) {
  try {
    const parishId = resolveParishId(req);
    await validateParishAccess(req, parishId, "Scheduling Date Rule Update");
    const data = await service.updateDateRule(parishId, req.params.ruleId, req.body, req.user.id);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}

export async function deleteDateRule(req, res, next) {
  try {
    const parishId = resolveParishId(req);
    await validateParishAccess(req, parishId, "Scheduling Date Rule Removal");
    const data = await service.deleteDateRule(
      parishId,
      req.params.ruleId,
      req.query.expectedVersion,
      req.user.id
    );
    return res.status(200).json({ success: true, data });
  } catch (error) {
    return next(error);
  }
}
