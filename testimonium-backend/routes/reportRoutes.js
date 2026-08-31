import { Router } from "express";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody, validateQuery } from "../middlewares/validateRequest.js";
import { list, getById, create, update, archive } from "../controllers/ReportController.js";
import {
  createReportSchema,
  updateReportSchema,
  reportListQuerySchema,
  archiveReportQuerySchema,
} from "../validators/reportSchemas.js";

const router = Router();
router.use(authenticateFirebaseToken, checkRole(["SECRETARY", "DIOCESE_COORDINATOR"]));
router.get("/", validateQuery(reportListQuerySchema), list);
router.post("/", validateBody(createReportSchema), create);
router.get("/:id", getById);
router.patch("/:id", validateBody(updateReportSchema), update);
router.delete("/:id", validateQuery(archiveReportQuerySchema), archive);

export default router;
