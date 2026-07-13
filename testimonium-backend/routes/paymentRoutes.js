import { Router } from "express";
import { getPaymentConfiguration } from "../controllers/PaymentController.js";
import { authenticateFirebaseToken } from "../middlewares/authMiddleware.js";

const router = Router();

// Apply auth check
router.use(authenticateFirebaseToken);

router.get("/configuration", getPaymentConfiguration);

export default router;
