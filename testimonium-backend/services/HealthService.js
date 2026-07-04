import { HealthRepository } from "../repositories/HealthRepository.js";

export class HealthService {
  constructor(healthRepository = new HealthRepository()) {
    this.healthRepository = healthRepository;
  }

  async getHealthStatus() {
    await this.healthRepository.verifyDatabaseConnection();

    return {
      status: "healthy",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  }
}
