import { Router } from "express";
import { DocumentRequirementService } from "../services/DocumentRequirementService.js";
import { requireCanonicalRelationship, resolveRelationshipEvidence } from "../config/relationshipEvidence.js";

const router = Router();

// GET /api/v1/document-requirements — Get all or specific document requirements metadata
router.get("/", async (req, res, next) => {
  try {
    const { type, parishId, relationship } = req.query;
    let requirements = await DocumentRequirementService.getRequirements(type, parishId);
    if (relationship !== undefined) {
      const canonical = requireCanonicalRelationship(relationship, { allowOmitted: false });
      requirements = type
        ? { ...requirements, relationshipEvidence: resolveRelationshipEvidence(canonical) }
        : Object.fromEntries(Object.entries(requirements).map(([key, value]) => [key, { ...value, relationshipEvidence: resolveRelationshipEvidence(canonical) }]));
    }
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
    const { parishId, relationship } = req.query;
    let requirements = await DocumentRequirementService.getRequirements(type, parishId);
    if (relationship !== undefined) {
      const canonical = requireCanonicalRelationship(relationship, { allowOmitted: false });
      requirements = { ...requirements, relationshipEvidence: resolveRelationshipEvidence(canonical) };
    }
    res.json({
      success: true,
      data: requirements,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
