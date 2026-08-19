import { Router } from "express";
import { ParishAvailabilityService } from "../services/ParishAvailabilityService.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { getEffectiveParishId, validateParishAccess } from "../utils/tenantGuard.js";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/", async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    let targetParishId;

    if (req.user.role === "DIOCESE_COORDINATOR") {
      targetParishId = req.query.parishId ? parseInt(req.query.parishId, 10) : undefined;
    } else if (req.user.role === "SECRETARY" || req.user.role === "PRIEST") {
      targetParishId = req.user.parish?.id;
      if (req.query.parishId && parseInt(req.query.parishId, 10) !== targetParishId) {
        await validateParishAccess(req, req.query.parishId, "Parish Availability Directory");
      }
    } else {
      // Parishioner public query
      targetParishId = req.query.parishId ? parseInt(req.query.parishId, 10) : undefined;
    }

    const availabilities = await ParishAvailabilityService.getAvailabilities(targetParishId, startDate, endDate);
    res.json({ success: true, data: availabilities });
  } catch (error) {
    next(error);
  }
});

router.post("/", checkRole(["DIOCESE_COORDINATOR", "SECRETARY", "PRIEST"]), async (req, res, next) => {
  try {
    const parishId = getEffectiveParishId(req, req.body.parishId);
    if (!parishId) {
      return res.status(400).json({ success: false, message: "Parish ID is required." });
    }
    await validateParishAccess(req, parishId, "Parish Availability");

    const record = await ParishAvailabilityService.createAvailability({ ...req.body, parishId }, req.user?.id);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", checkRole(["DIOCESE_COORDINATOR", "SECRETARY", "PRIEST"]), async (req, res, next) => {
  try {
    await ParishAvailabilityService.deleteAvailability(req.params.id, req.user?.id, req);
    res.json({ success: true, message: "Availability record deleted." });
  } catch (error) {
    next(error);
  }
});

export default router;
