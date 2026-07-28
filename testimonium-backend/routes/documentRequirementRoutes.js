import { Router } from "express";
import { DocumentRequirementService } from "../services/DocumentRequirementService.js";

const router = Router();

// GET /api/v1/document-requirements — Get all or specific document requirements metadata
router.get("/", async (req, res, next) => {
  try {
    const { type, parishId } = req.query;
    const requirements = await DocumentRequirementService.getRequirements(type, parishId);
    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:type", async (req, res, next) => {
  try {
    const { type } = req.params;
    const { parishId } = req.query;
    const requirements = await DocumentRequirementService.getRequirements(type, parishId);
    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
