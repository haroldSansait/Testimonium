import { Router } from "express";
import { getHealth } from "../controllers/HealthController.js";

const router = Router();

router.get("/", getHealth);

export default router;
