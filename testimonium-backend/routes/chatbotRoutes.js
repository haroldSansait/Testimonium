import { Router } from "express";
import { chatbotController } from "../controllers/ChatbotController.js";
import { knowledgeController } from "../controllers/KnowledgeController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";
import { checkRole } from "../middlewares/roleMiddleware.js";
import { validateBody, validateQuery } from "../middlewares/validateRequest.js";
import { chatbotQuerySchema } from "../validators/chatbotSchemas.js";
import {
  createKnowledgeSourceSchema,
  updateKnowledgeSourceSchema,
  versionedActionSchema,
  listKnowledgeSchema,
} from "../validators/knowledgeSchemas.js";
import {
  chatGeneralAbuseLimiter,
} from "../middlewares/rateLimit.js";

const router = Router();

// ==============================================================================
// 1. PUBLIC / PARISHIONER QUERY ENDPOINT
// ==============================================================================
router.post(
  "/query",
  authenticateFirebaseToken,
  checkRole(["PARISHIONER"]),
  chatGeneralAbuseLimiter,
  validateBody(chatbotQuerySchema),
  chatbotController.queryChatbot
);

// ==============================================================================
// 2. ADMIN KNOWLEDGE BASE GOVERNANCE ENDPOINTS (DIOCESE_COORDINATOR ONLY)
// ==============================================================================
const coordinatorAuth = [authenticateFirebaseToken, checkRole(["DIOCESE_COORDINATOR"])];

router.get("/knowledge", ...coordinatorAuth, validateQuery(listKnowledgeSchema), knowledgeController.list);

router.post(
  "/knowledge",
  ...coordinatorAuth,
  validateBody(createKnowledgeSourceSchema),
  knowledgeController.create
);

router.get("/knowledge/:id", ...coordinatorAuth, knowledgeController.getById);

router.patch(
  "/knowledge/:id",
  ...coordinatorAuth,
  validateBody(updateKnowledgeSourceSchema),
  knowledgeController.update
);

router.post(
  "/knowledge/:id/confirm",
  ...coordinatorAuth,
  validateBody(versionedActionSchema),
  knowledgeController.confirm
);

router.post(
  "/knowledge/:id/publish",
  ...coordinatorAuth,
  validateBody(versionedActionSchema),
  knowledgeController.publish
);

router.post(
  "/knowledge/:id/retire",
  ...coordinatorAuth,
  validateBody(versionedActionSchema),
  knowledgeController.retire
);

router.post(
  "/knowledge/:id/retry-embedding",
  ...coordinatorAuth,
  validateBody(versionedActionSchema),
  knowledgeController.retryEmbedding
);

export default router;
