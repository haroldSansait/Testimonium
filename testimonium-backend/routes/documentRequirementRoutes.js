import { Router } from "express";
import { DocumentRequirementService } from "../services/DocumentRequirementService.js";

const router = Router();

// GET /api/v1/document-requirements — Get all or specific document requirements metadata
router.get("/", (req, res, next) => {
  try {
    const { type } = req.query;
    const requirements = DocumentRequirementService.getRequirements(type);
    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:type", (req, res, next) => {
  try {
    const { type } = req.params;
    const requirements = DocumentRequirementService.getRequirements(type);
    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
