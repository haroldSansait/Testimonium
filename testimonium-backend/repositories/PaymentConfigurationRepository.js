import { prisma } from "../config/db.js";

export class PaymentConfigurationRepository {
  /**
   * Look up the parish details to dynamically extract parish name and contact info.
   * Currently, since there is no separate table for configurations, we query the parish record.
   * @param {number} parishId
   */
  async findByParishId(parishId) {
    if (!parishId) return null;
    return prisma.parish.findUnique({
      where: { id: parseInt(parishId, 10) }
    });
  }
}
