import { Router } from "express";
import { ParishAvailabilityService } from "../services/ParishAvailabilityService.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";

const router = Router();

router.use(authenticateFirebaseToken);

router.get("/", async (req, res, next) => {
  try {
    const { parishId, startDate, endDate } = req.query;
    const availabilities = await ParishAvailabilityService.getAvailabilities(parishId, startDate, endDate);
    res.json({ success: true, data: availabilities });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const record = await ParishAvailabilityService.createAvailability(req.body, req.user?.id);
    res.status(201).json({ success: true, data: record });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await ParishAvailabilityService.deleteAvailability(req.params.id, req.user?.id);
    res.json({ success: true, message: "Availability record deleted." });
  } catch (error) {
    next(error);
  }
});

export default router;
