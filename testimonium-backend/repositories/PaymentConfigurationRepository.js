import { prisma } from "../config/db.js";

export class PaymentConfigurationRepository {
  /**
   * Retrieve only the fields that define the generic parish payment QR.
   */
  async findByParishId(parishId) {
    if (!parishId) return null;
    return prisma.parish.findUnique({
      where: { id: parseInt(parishId, 10) },
      select: {
        id: true,
        paymentQrEnabled: true,
        paymentQrImage: true,
      },
    });
  }

  /**
   * Payment configuration is request-scoped. Resolve the parish only through
   * a request owned by the authenticated parishioner.
   */
  async findOwnedRequestById(requestId, userId) {
    return prisma.documentRequest.findFirst({
      where: {
        id: parseInt(requestId, 10),
        userId: parseInt(userId, 10),
      },
      select: {
        id: true,
        parishId: true,
      },
    });
  }
}
