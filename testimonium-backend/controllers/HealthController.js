import { HealthService } from "../services/HealthService.js";

const healthService = new HealthService();

export const getHealth = async (_req, res) => {
  try {
    const health = await healthService.getHealthStatus();
    return res.status(200).json(health);
  } catch {
    return res.status(503).json({
      status: "unhealthy",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
};
