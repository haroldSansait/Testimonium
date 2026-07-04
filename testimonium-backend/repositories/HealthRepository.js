import { prisma } from "../config/db.js";

export class HealthRepository {
  async verifyDatabaseConnection() {
    await prisma.$connect();
    return true;
  }
}
